import FamilyControls
import ManagedSettings

/// Applies and removes Focusling shields. Two named stores keep the whole-app
/// session shield separate from the temporary Reels intervention shield.
final class ShieldController {
  private let session = ManagedSettingsStore(named: FocuslingShared.sessionStore)
  private let intervention = ManagedSettingsStore(named: FocuslingShared.interventionStore)

  func applySessionShield(_ tokens: Set<ApplicationToken>) {
    session.shield.applications = tokens.isEmpty ? nil : tokens
  }

  func applyInterventionShield(_ tokens: Set<ApplicationToken>, sessionId: String) {
    FocuslingShared.defaults?.set(true, forKey: FocuslingShared.Key.interventionActive)
    FocuslingShared.defaults?.set(sessionId, forKey: FocuslingShared.Key.interventionSessionId)
    intervention.shield.applications = tokens.isEmpty ? nil : tokens
  }

  func clearIntervention() { FocuslingShared.clearInterventionShield() }
  func clearAll() { FocuslingShared.clearAllShields() }

  var status: String {
    if !(intervention.shield.applications ?? []).isEmpty { return "intervention" }
    if !(session.shield.applications ?? []).isEmpty { return "session" }
    return "none"
  }
}
