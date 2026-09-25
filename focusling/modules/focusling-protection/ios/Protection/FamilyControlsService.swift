import FamilyControls
import SwiftUI
import UIKit

/// Screen Time authorization and the private app picker. Tokens are opaque:
/// Focusling never learns which apps were chosen and never logs or uploads them.
@MainActor
final class FamilyControlsService {
  private let center = AuthorizationCenter.shared

  var authorizationState: String {
    switch center.authorizationStatus {
    case .approved: return "approved"
    case .denied: return "denied"
    case .notDetermined: return "notDetermined"
    @unknown default: return "notDetermined"
    }
  }

  func requestAuthorization() async -> String {
    do {
      try await center.requestAuthorization(for: .individual)
    } catch {
      // Denied or cancelled: report the resulting state rather than throwing.
    }
    return authorizationState
  }

  var selection: FamilyActivitySelection {
    guard let data = FocuslingShared.defaults?.data(forKey: FocuslingShared.Key.selection),
          let decoded = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data) else {
      return FamilyActivitySelection()
    }
    return decoded
  }

  var selectedAppCount: Int { selection.applicationTokens.count }

  /// Presents FamilyActivityPicker and resolves with the number of selected apps.
  func presentPicker() async -> Int {
    guard let presenter = Self.topViewController() else { return selectedAppCount }
    let initial = selection
    let chosen: FamilyActivitySelection = await withCheckedContinuation { continuation in
      var finished = false
      let host = UIHostingController(rootView: AppPickerView(initial: initial) { result in
        guard !finished else { return }
        finished = true
        presenter.dismiss(animated: true)
        continuation.resume(returning: result)
      })
      host.isModalInPresentation = true // finish with Done/Cancel so the continuation always resumes
      presenter.present(host, animated: true)
    }
    if let data = try? JSONEncoder().encode(chosen) {
      FocuslingShared.defaults?.set(data, forKey: FocuslingShared.Key.selection)
    }
    return chosen.applicationTokens.count
  }

  static func topViewController() -> UIViewController? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    var top = scenes.flatMap(\.windows).first { $0.isKeyWindow }?.rootViewController
    while let presented = top?.presentedViewController { top = presented }
    return top
  }
}

private struct AppPickerView: View {
  @State var selection: FamilyActivitySelection
  let onDone: (FamilyActivitySelection) -> Void
  private let initial: FamilyActivitySelection

  init(initial: FamilyActivitySelection, onDone: @escaping (FamilyActivitySelection) -> Void) {
    _selection = State(initialValue: initial)
    self.initial = initial
    self.onDone = onDone
  }

  var body: some View {
    NavigationStack {
      FamilyActivityPicker(selection: $selection)
        .navigationTitle("Choose Instagram")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .cancellationAction) { Button("Cancel") { onDone(initial) } }
          ToolbarItem(placement: .confirmationAction) { Button("Done") { onDone(selection) } }
        }
    }
  }
}
