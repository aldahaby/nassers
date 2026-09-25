import FamilyControls
import Foundation

/// Interrupts a detected distraction with a temporary shield. The shield is
/// removed by the ShieldAction extension ("Back to focus"), or by a safety
/// timer if no action arrives. Interventions never end the focus session.
final class InterventionController {
  private let shields: ShieldController
  private var safetyTimer: DispatchWorkItem?
  private(set) var lastInterventionMs: Double?

  init(shields: ShieldController) { self.shields = shields }

  func intervene(sessionId: String, tokens: Set<ApplicationToken>, timeoutMs: Double) {
    lastInterventionMs = FocuslingShared.nowMs()
    shields.applyInterventionShield(tokens, sessionId: sessionId)
    safetyTimer?.cancel()
    let work = DispatchWorkItem { [weak self] in
      guard FocuslingShared.defaults?.string(forKey: FocuslingShared.Key.interventionSessionId) == sessionId else { return }
      self?.shields.clearIntervention()
    }
    safetyTimer = work
    DispatchQueue.main.asyncAfter(deadline: .now() + timeoutMs / 1000, execute: work)
  }

  func cancel() {
    safetyTimer?.cancel()
    safetyTimer = nil
    shields.clearIntervention()
  }
}
