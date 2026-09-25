import ManagedSettings

/// "Back to focus". Uses only documented ShieldActionResponse values.
/// For a Reels intervention the temporary shield is removed first, then `.close`
/// closes the shielded app. Reopening it works normally (the app-side detector
/// has a cooldown, so there is no immediate re-shield loop).
/// For a whole-app session shield, `.close` just closes the app; the shield stays.
final class ShieldActionExtension: ShieldActionDelegate {
  override func handle(action: ShieldAction, for application: ApplicationToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {
    respond(to: action, completionHandler)
  }

  override func handle(action: ShieldAction, for webDomain: WebDomainToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {
    respond(to: action, completionHandler)
  }

  override func handle(action: ShieldAction, for category: ActivityCategoryToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {
    respond(to: action, completionHandler)
  }

  private func respond(to action: ShieldAction, _ completionHandler: @escaping (ShieldActionResponse) -> Void) {
    switch action {
    case .primaryButtonPressed:
      FocuslingShared.defaults?.set(FocuslingShared.nowMs(), forKey: FocuslingShared.Key.lastShieldActionMs)
      if FocuslingShared.interventionActive { FocuslingShared.clearInterventionShield() }
      completionHandler(.close)
    case .secondaryButtonPressed:
      completionHandler(.none)
    @unknown default:
      completionHandler(.none)
    }
  }
}
