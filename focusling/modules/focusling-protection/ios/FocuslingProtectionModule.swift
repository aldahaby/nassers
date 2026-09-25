import ExpoModulesCore

struct StartProtectionRequest: Record {
  @Field var sessionId: String = ""
  @Field var mode: String = ""
  @Field var surfaces: [String] = []
  @Field var endsAtMs: Double = 0
  @Field var policy: [String: Double] = [:]
  @Field var samplesPerSecond: Double = 1
  @Field var analysisMaxDimension: Double = 640
  @Field var interventionShieldTimeoutMs: Double = 60_000
  @Field var petName: String = ""
}

/// JS bridge for focus protection. All state lives in `ProtectionCoordinator`;
/// this module only translates calls, errors and events.
public final class FocuslingProtectionModule: Module {
  private var coordinator: ProtectionCoordinator?

  @MainActor
  private func shared() -> ProtectionCoordinator {
    if let coordinator { return coordinator }
    let created = ProtectionCoordinator { [weak self] event, body in self?.sendEvent(event, body) }
    coordinator = created
    return created
  }

  public func definition() -> ModuleDefinition {
    Name("FocuslingProtection")

    Events("onStatus", "onIntervention", "onCaptureStopped", "onAuthorizationLost")

    AsyncFunction("getStatus") { () async -> [String: Any] in
      await self.shared().status()
    }

    AsyncFunction("requestAuthorization") { () async -> String in
      await self.shared().requestAuthorization()
    }

    AsyncFunction("presentAppPicker") { () async -> Int in
      await self.shared().presentAppPicker()
    }

    AsyncFunction("startProtection") { (request: StartProtectionRequest) async throws -> [String: Any] in
      guard request.mode == "selective" || request.mode == "wholeApp", !request.sessionId.isEmpty else {
        throw Exception(name: "InvalidRequest", description: "Invalid protection request", code: "ERR_NATIVE_ERROR")
      }
      do {
        return try await self.shared().start(.init(
          sessionId: request.sessionId,
          mode: request.mode,
          endsAt: Date(timeIntervalSince1970: request.endsAtMs / 1000),
          policy: DetectionPolicyConfig(dictionary: request.policy),
          samplesPerSecond: request.samplesPerSecond,
          analysisMaxDimension: request.analysisMaxDimension,
          interventionShieldTimeoutMs: request.interventionShieldTimeoutMs,
          petName: request.petName
        ))
      } catch let error as ProtectionCoordinator.StartError {
        switch error {
        case .notAuthorized:
          throw Exception(name: "NotAuthorized", description: "Screen Time access is needed", code: "ERR_SCREEN_TIME_NOT_AUTHORIZED")
        case .noAppsSelected:
          throw Exception(name: "NoApps", description: "No app selected", code: "ERR_NO_APPS_SELECTED")
        case .screenRecognitionUnavailable:
          throw Exception(name: "NoRecognition", description: "Screen recognition unavailable", code: "ERR_SCREEN_RECOGNITION_UNAVAILABLE")
        case .captureNotConfirmed(let message):
          throw Exception(name: "CaptureNotConfirmed", description: message, code: "ERR_CAPTURE_NOT_CONFIRMED")
        case .native(let message):
          throw Exception(name: "Native", description: message, code: "ERR_NATIVE_ERROR")
        }
      }
    }

    AsyncFunction("endProtection") { (sessionId: String?, reason: String) async in
      await self.shared().end(sessionId: sessionId, reason: reason)
    }

    AsyncFunction("emergencyCleanup") { () async in
      await self.shared().emergencyCleanup()
    }

    AsyncFunction("debugTriggerFakeDetection") { () async in await self.shared().debugFakeDetection() }
    AsyncFunction("debugClearShields") { () async in await self.shared().debugClearShields() }
    AsyncFunction("debugStopCapture") { () async in await self.shared().debugStopCapture() }
    AsyncFunction("debugRestartCapture") { () async throws in try await self.shared().debugRestartCapture() }

    // Debug-only sample collection. Rejected in release builds.
    AsyncFunction("debugSetSampleCollection") { (label: String?) async throws in
      #if DEBUG
      try await self.shared().samples.setLabel(label)
      #else
      throw Exception(name: "DebugOnly", description: "Sample collection is only available in debug builds", code: "ERR_DEBUG_ONLY")
      #endif
    }
    AsyncFunction("debugSampleCounts") { () async -> [String: Int] in
      #if DEBUG
      return await self.shared().samples.counts()
      #else
      return [:]
      #endif
    }
    AsyncFunction("debugExportSamples") { () async in
      #if DEBUG
      await self.shared().samples.export()
      #endif
    }
    AsyncFunction("debugDeleteSamples") { () async in
      #if DEBUG
      await self.shared().samples.deleteAll()
      #endif
    }
  }
}
