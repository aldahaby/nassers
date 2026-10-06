import Foundation

/// The minimal snapshot the app writes to the App Group (src/core/planner/privacy.ts › WidgetSnapshot).
/// No syllabus text, notes, retrieval items or tokens ever reach the widget.
struct WidgetSnapshot: Codable {
  struct ActiveSession: Codable {
    let endsAt: Double
    let protection: String
  }
  struct Pet: Codable {
    let speciesId: String
    let stage: String
  }
  let v: Int
  let generatedAt: Double
  let privacyMode: String
  let nextPlanId: String?
  let courseDisplayName: String?
  let assignmentDisplayTitle: String?
  let plannedStart: Double?
  let plannedMinutes: Int?
  let todayPlanCount: Int
  let todayMinutes: Int
  let activeSession: ActiveSession?
  let pet: Pet?

  static func load() -> WidgetSnapshot? {
    guard let json = UserDefaults(suiteName: StudylingShared.appGroup)?.string(forKey: StudylingShared.snapshotKey),
          let data = json.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
  }

  var plannedStartDate: Date? { plannedStart.map { Date(timeIntervalSince1970: $0 / 1000) } }

  /// One-tap start: opens the app's start route, which begins the planned session with protection.
  var startURL: URL? {
    guard let id = nextPlanId else { return URL(string: "focusling://planner") }
    return URL(string: "focusling://planner/start?plan=\(id)&source=widget")
  }

  static let placeholder = WidgetSnapshot(v: 1, generatedAt: 0, privacyMode: "private", nextPlanId: nil, courseDisplayName: nil, assignmentDisplayTitle: nil, plannedStart: nil, plannedMinutes: 45, todayPlanCount: 2, todayMinutes: 75, activeSession: nil, pet: nil)
}

import SwiftUI

extension Color {
  /// Studyling purple (#7B5CFF) and the warm widget background (#FFFDF9).
  static let studyling = Color(red: 123 / 255, green: 92 / 255, blue: 1)
  static let studylingBackground = Color(red: 1, green: 253 / 255, blue: 249 / 255)
}
