import DeviceActivity
import ManagedSettings

/// Ends session protection when the scheduled interval ends, even if Focusling
/// isn't running (for example after a force quit). Stale activities from older
/// sessions only clean up and never touch a newer session's shields.
final class DeviceActivityMonitorExtension: DeviceActivityMonitor {
  override func intervalDidEnd(for activity: DeviceActivityName) {
    super.intervalDidEnd(for: activity)
    let prefix = "focusling.session."
    guard activity.rawValue.hasPrefix(prefix) else { return }
    let endedSession = String(activity.rawValue.dropFirst(prefix.count))
    guard endedSession == FocuslingShared.sessionId else { return } // stale activity for an old session
    FocuslingShared.clearAllShields()
    FocuslingShared.defaults?.set(endedSession, forKey: FocuslingShared.Key.scheduleEndedSessionId)
    FocuslingShared.clearSession()
  }
}
