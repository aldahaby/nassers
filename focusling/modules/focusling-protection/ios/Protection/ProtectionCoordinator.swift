import Combine
import FamilyControls
import Foundation

/// Native source of truth for focus protection. JS only shows "protection
/// active" when the status reported here says so for the current session ID.
@MainActor
final class ProtectionCoordinator {
  struct StartRequest {
    let sessionId: String
    let mode: String // "selective" | "wholeApp"
    let endsAt: Date
    let policy: DetectionPolicyConfig
    let samplesPerSecond: Double
    let analysisMaxDimension: Double
    let interventionShieldTimeoutMs: Double
    let petName: String
  }

  enum StartError: Error {
    case notAuthorized, noAppsSelected, screenRecognitionUnavailable, captureNotConfirmed(String), native(String)
  }

  typealias Emit = (_ event: String, _ body: [String: Any]) -> Void

  private let emit: Emit
  private let familyControls = FamilyControlsService()
  private let shields = ShieldController()
  private let scheduler = SessionScheduler()
  private lazy var interventions = InterventionController(shields: shields)
  private let detector: ContentSurfaceDetector = VisionReelsDetector()
  private let detectionQueue = DispatchQueue(label: "focusling.detection", qos: .utility)
  let samples = SampleCollector()
  /// Checked on the capture queue so dropped frames never touch the main actor.
  nonisolated private let gate = FrameGate()

  private var captureBox: AnyObject? // ScreenCaptureController on iOS 27+
  private var sessionId: String?
  private var mode: String = "none"
  private var captureStatus = "idle"
  private var policy = DetectionPolicy(config: DetectionPolicyConfig())
  private var minFrameIntervalMs: Double = 1000
  private var interventionTimeoutMs: Double = 60_000
  private var lastSampleMs: Double = 0
  private var detecting = false
  private var latest: SurfaceClassification?
  private var lastError: String?
  private var authCancellable: AnyCancellable?

  init(emit: @escaping Emit) {
    self.emit = emit
    restorePersistedSession()
    authCancellable = AuthorizationCenter.shared.$authorizationStatus
      .removeDuplicates()
      .sink { [weak self] status in
        guard let self, status != .approved, self.sessionId != nil else { return }
        self.shields.clearAll()
        self.emit("onAuthorizationLost", [:])
        self.publishStatus()
      }
  }

  // MARK: Status

  var screenRecognition: String {
    if #available(iOS 27.0, *) { return ScreenCaptureController.isAvailable ? "available" : "unavailable" }
    return "unavailable"
  }

  func status() -> [String: Any] {
    var latestDict: Any = NSNull()
    if let latest {
      latestDict = ["app": latest.app.rawValue, "surface": latest.surface.rawValue, "confidence": latest.confidence]
    }
    return [
      "platform": "ios",
      "authorization": familyControls.authorizationState,
      "screenRecognition": screenRecognition,
      "captureStatus": captureStatus,
      "monitoringStatus": scheduler.isMonitoring ? "active" : "idle",
      "shieldStatus": shields.status,
      "selectedTargetCount": familyControls.selectedAppCount,
      "currentSessionId": sessionId ?? NSNull(),
      "activeMode": sessionId == nil ? "none" : mode,
      "detection": [
        "latest": latestDict,
        "votes": policy.votes,
        "window": policy.config.windowSize,
        "lastInterventionAt": interventions.lastInterventionMs ?? NSNull(),
      ],
      "lastError": lastError ?? NSNull(),
    ]
  }

  private func publishStatus() { emit("onStatus", status()) }

  func requestAuthorization() async -> String {
    let result = await familyControls.requestAuthorization()
    publishStatus()
    return result
  }

  func presentAppPicker() async -> Int {
    let count = await familyControls.presentPicker()
    publishStatus()
    return count
  }

  // MARK: Start

  func start(_ request: StartRequest) async throws -> [String: Any] {
    guard familyControls.authorizationState == "approved" else { throw StartError.notAuthorized }
    let tokens = familyControls.selection.applicationTokens
    guard !tokens.isEmpty else { throw StartError.noAppsSelected }

    await end(sessionId: nil, reason: "restart") // never overlap sessions
    lastError = nil
    sessionId = request.sessionId
    mode = request.mode
    persistSession(request)

    do {
      try scheduler.start(sessionId: request.sessionId, endsAt: request.endsAt)
    } catch {
      lastError = "DeviceActivity: \(error.localizedDescription)"
      // Not fatal for selective mode; whole-app still shields directly below.
    }

    if request.mode == "wholeApp" {
      shields.applySessionShield(tokens)
      publishStatus()
      return status()
    }

    // Selective: screen recognition must actually be running before we confirm.
    guard #available(iOS 27.0, *), ScreenCaptureController.isAvailable else {
      await end(sessionId: request.sessionId, reason: "error-recovery")
      throw StartError.screenRecognitionUnavailable
    }
    policy = DetectionPolicy(config: request.policy)
    minFrameIntervalMs = 1000 / max(0.1, request.samplesPerSecond)
    gate.configure(intervalMs: minFrameIntervalMs)
    interventionTimeoutMs = request.interventionShieldTimeoutMs
    let capture = ScreenCaptureController()
    captureBox = capture
    capture.onFrame = { [weak self] pixelBuffer in self?.handleFrame(pixelBuffer) }
    capture.onStop = { [weak self] reason, error in self?.captureStopped(reason: reason, error: error) }
    captureStatus = "awaitingPicker"
    publishStatus()
    do {
      try await capture.start(maxDimension: request.analysisMaxDimension)
    } catch {
      let message = error.localizedDescription
      await end(sessionId: request.sessionId, reason: "error-recovery")
      lastError = message
      throw StartError.captureNotConfirmed(message)
    }
    guard capture.isRunning, sessionId == request.sessionId else {
      await end(sessionId: request.sessionId, reason: "error-recovery")
      throw StartError.captureNotConfirmed("Capture did not start")
    }
    captureStatus = "running"
    publishStatus()
    return status()
  }

  // MARK: End (the single cleanup path)

  func end(sessionId requested: String?, reason: String) async {
    if let requested, let current = sessionId, requested != current { return } // stale request
    if #available(iOS 27.0, *), let capture = captureBox as? ScreenCaptureController { await capture.stop() }
    captureBox = nil
    interventions.cancel()
    shields.clearAll()
    scheduler.stopAll()
    sessionId = nil
    mode = "none"
    captureStatus = "idle"
    latest = nil
    policy.reset()
    FocuslingShared.clearSession()
    publishStatus()
  }

  func emergencyCleanup() async {
    await end(sessionId: nil, reason: "emergency")
    shields.clearAll()
    scheduler.stopAll()
  }

  // MARK: Frames → detection → intervention

  /// Called on the capture queue. Drops frames unless it's time for a sample and the detector is idle.
  nonisolated private func handleFrame(_ pixelBuffer: CVPixelBuffer) {
    let now = FocuslingShared.nowMs()
    guard gate.shouldSample(atMs: now) else { return } // most frames end here
    Task { @MainActor in
      guard let session = self.sessionId, self.mode == "selective", !self.detecting else { return }
      self.lastSampleMs = now
      self.detecting = true
      #if DEBUG
      self.samples.consider(pixelBuffer)
      #endif
      self.detectionQueue.async {
        let classification = self.detector.classify(pixelBuffer)
        Task { @MainActor in self.detected(classification, at: now, forSession: session) }
      }
    }
  }

  private func detected(_ classification: SurfaceClassification, at: Double, forSession session: String) {
    detecting = false
    guard session == sessionId else { return } // stale: session changed while classifying
    latest = classification
    let intervene = policy.record(classification, atMs: at)
    if intervene { performIntervention(session: session, at: at) }
    publishStatus()
  }

  private func performIntervention(session: String, at: Double) {
    let tokens = familyControls.selection.applicationTokens
    guard !tokens.isEmpty else { return }
    interventions.intervene(sessionId: session, tokens: tokens, timeoutMs: interventionTimeoutMs)
    emit("onIntervention", ["sessionId": session, "surface": "instagramReels", "at": at])
  }

  @available(iOS 27.0, *)
  private func captureStopped(reason: ScreenCaptureController.StopReason, error: Error?) {
    guard let session = sessionId, mode == "selective" else { return }
    captureStatus = "stopped"
    lastError = error?.localizedDescription
    interventions.cancel()
    emit("onCaptureStopped", ["sessionId": session, "reason": reason.rawValue])
    publishStatus()
  }

  // MARK: Debug

  func debugFakeDetection() {
    guard let session = sessionId, mode == "selective" else { return }
    let start = FocuslingShared.nowMs()
    for i in 0..<policy.config.windowSize {
      let at = start + Double(i) * 600
      let c = SurfaceClassification(app: .instagram, surface: .instagramReels, confidence: 0.95)
      latest = c
      if policy.record(c, atMs: at) {
        performIntervention(session: session, at: at)
        break
      }
    }
    publishStatus()
  }

  func debugClearShields() {
    interventions.cancel()
    if mode != "wholeApp" { shields.clearAll() }
    publishStatus()
  }

  func debugStopCapture() async {
    if #available(iOS 27.0, *), let capture = captureBox as? ScreenCaptureController {
      await capture.stop()
      captureStopped(reason: .userStopped, error: nil)
    }
  }

  func debugRestartCapture() async throws {
    guard #available(iOS 27.0, *), let session = sessionId, mode == "selective" else { return }
    let capture = (captureBox as? ScreenCaptureController) ?? ScreenCaptureController()
    captureBox = capture
    capture.onFrame = { [weak self] pb in self?.handleFrame(pb) }
    capture.onStop = { [weak self] reason, error in self?.captureStopped(reason: reason, error: error) }
    captureStatus = "awaitingPicker"
    publishStatus()
    try await capture.start(maxDimension: 640)
    captureStatus = (capture.isRunning && sessionId == session) ? "running" : "failed"
    publishStatus()
  }

  // MARK: Persistence (App Group)

  private func persistSession(_ r: StartRequest) {
    guard let d = FocuslingShared.defaults else { return }
    d.set(r.sessionId, forKey: FocuslingShared.Key.sessionId)
    d.set(r.mode, forKey: FocuslingShared.Key.mode)
    d.set(r.endsAt.timeIntervalSince1970 * 1000, forKey: FocuslingShared.Key.endsAtMs)
    d.set(r.petName, forKey: FocuslingShared.Key.petName)
  }

  /// After a relaunch, whole-app protection may still be in force; selective
  /// capture never survives a relaunch, so it reports "stopped" and JS offers a restart.
  private func restorePersistedSession() {
    guard let id = FocuslingShared.sessionId, let storedMode = FocuslingShared.mode else { return }
    sessionId = id
    mode = storedMode
    captureStatus = storedMode == "selective" ? "stopped" : "idle"
  }
}

/// Thread-safe sampling gate: lets through at most one frame per interval.
final class FrameGate: @unchecked Sendable {
  private let lock = NSLock()
  private var intervalMs: Double = 1000
  private var lastMs: Double = 0

  func configure(intervalMs: Double) {
    lock.lock(); defer { lock.unlock() }
    self.intervalMs = intervalMs
    lastMs = 0
  }

  func shouldSample(atMs now: Double) -> Bool {
    lock.lock(); defer { lock.unlock() }
    guard now - lastMs >= intervalMs else { return false }
    lastMs = now
    return true
  }
}
