// FocuslingSharedState.swift
// CANONICAL COPY: modules/focusling-protection/ios/Shared/FocuslingSharedState.swift
// Copies live in targets/*/FocuslingSharedState.swift and must stay byte-identical
// (checked by src/core/__tests__/nativeSharedState.test.ts).
//
// State shared between the app and its Screen Time extensions through the App Group.
// Holds no screen content, no OCR text, and no app identity: only session metadata
// and the opaque FamilyActivitySelection (encoded as Apple provides it).

import Foundation
import ManagedSettings

enum FocuslingShared {
  static let appGroup = "group.com.focusling.app"
  static let sessionStore = ManagedSettingsStore.Name("focusling.session")
  static let interventionStore = ManagedSettingsStore.Name("focusling.intervention")

  enum Key {
    static let sessionId = "protection.sessionId"
    static let mode = "protection.mode"            // "selective" | "wholeApp"
    static let endsAtMs = "protection.endsAtMs"
    static let petName = "protection.petName"
    static let interventionActive = "protection.interventionActive"
    static let interventionSessionId = "protection.interventionSessionId"
    static let lastShieldActionMs = "protection.lastShieldActionMs"
    static let scheduleEndedSessionId = "protection.scheduleEndedSessionId"
    static let selection = "protection.selection"  // encoded FamilyActivitySelection (opaque tokens)
  }

  static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }

  static var sessionId: String? { defaults?.string(forKey: Key.sessionId) }
  static var mode: String? { defaults?.string(forKey: Key.mode) }
  static var petName: String { defaults?.string(forKey: Key.petName) ?? "Your pet" }
  static var interventionActive: Bool { defaults?.bool(forKey: Key.interventionActive) ?? false }

  static func nowMs() -> Double { Date().timeIntervalSince1970 * 1000 }

  /// Remove every Focusling shield, from any process (app or extension).
  static func clearAllShields() {
    ManagedSettingsStore(named: sessionStore).clearAllSettings()
    ManagedSettingsStore(named: interventionStore).clearAllSettings()
    defaults?.set(false, forKey: Key.interventionActive)
    defaults?.removeObject(forKey: Key.interventionSessionId)
  }

  /// Clear just the temporary Reels intervention shield.
  static func clearInterventionShield() {
    ManagedSettingsStore(named: interventionStore).clearAllSettings()
    defaults?.set(false, forKey: Key.interventionActive)
    defaults?.removeObject(forKey: Key.interventionSessionId)
  }

  static func clearSession() {
    guard let d = defaults else { return }
    [Key.sessionId, Key.mode, Key.endsAtMs, Key.petName].forEach { d.removeObject(forKey: $0) }
  }
}
