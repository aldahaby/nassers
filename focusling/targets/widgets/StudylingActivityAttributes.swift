// StudylingActivityAttributes.swift
// CANONICAL COPY: modules/studyling-native/ios/Shared/StudylingActivityAttributes.swift
// The widget extension has a byte-identical copy (targets/widgets/StudylingActivityAttributes.swift,
// checked by src/core/__tests__/nativeSharedState.test.ts). ActivityKit matches the app's
// activity and the extension's UI by this type, so both definitions must stay the same.
//
// Content is already privacy-filtered by the app (Private lock-screen mode never includes
// course or assignment names). No coins, shop or missions: a study session only.

import ActivityKit
import Foundation

@available(iOS 16.1, *)
struct StudylingActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    /// Always "Studyling".
    var title: String
    /// "CHEM 101 · Problem Set 4" (Detailed) or "Study session · 45 min" (Private).
    var subtitle: String
    var endsAt: Date
    /// "on" | "off" | "simulated" — "on" only when native protection confirmed it.
    var protection: String
  }
}

enum StudylingShared {
  static let appGroup = "group.com.focusling.app"
  static let snapshotKey = "studyling.widgetSnapshot"
}
