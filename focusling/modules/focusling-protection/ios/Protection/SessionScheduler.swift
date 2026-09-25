import DeviceActivity
import Foundation

/// DeviceActivity monitoring for a session, so the whole-app shield is removed by
/// the DeviceActivityMonitor extension even if Focusling has been force-quit.
/// Apple requires intervals of at least 15 minutes; shorter sessions are padded
/// (the app still clears protection at the real end).
final class SessionScheduler {
  static let minimumInterval: TimeInterval = 15 * 60
  private let center = DeviceActivityCenter()

  static func activityName(for sessionId: String) -> DeviceActivityName {
    DeviceActivityName("focusling.session.\(sessionId)")
  }

  func start(sessionId: String, endsAt: Date) throws {
    stopAll()
    let now = Date()
    let end = max(endsAt, now.addingTimeInterval(Self.minimumInterval + 60))
    let calendar = Calendar.current
    let schedule = DeviceActivitySchedule(
      intervalStart: calendar.dateComponents([.hour, .minute, .second], from: now),
      intervalEnd: calendar.dateComponents([.hour, .minute, .second], from: end),
      repeats: false
    )
    try center.startMonitoring(Self.activityName(for: sessionId), during: schedule)
  }

  func stopAll() {
    let ours = center.activities.filter { $0.rawValue.hasPrefix("focusling.") }
    if !ours.isEmpty { center.stopMonitoring(ours) }
  }

  var isMonitoring: Bool { center.activities.contains { $0.rawValue.hasPrefix("focusling.") } }
}
