import CoreImage
import Foundation
import UIKit

/// DEBUG BUILDS ONLY: developer-initiated collection of labelled, downscaled
/// screenshots from the developer's own phone, for training a future detector.
/// Explicit opt-in from Developer Mode, stored only in the app's Application
/// Support folder, never uploaded, exported manually through the share sheet.
/// Compiled out of release builds.
final class SampleCollector {
  #if DEBUG
  static let labels = ["instagram_reels", "instagram_home", "instagram_dm", "instagram_post", "instagram_profile", "other"]
  private(set) var activeLabel: String?
  private var lastSavedMs: Double = 0
  private let intervalMs: Double = 2000
  private let context = CIContext()

  private var root: URL {
    let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    return base.appendingPathComponent("detector-samples", isDirectory: true)
  }

  func setLabel(_ label: String?) throws {
    if let label, !Self.labels.contains(label) { throw NSError(domain: "Focusling", code: 1, userInfo: [NSLocalizedDescriptionKey: "Unknown label"]) }
    activeLabel = label
  }

  func consider(_ pixelBuffer: CVPixelBuffer) {
    guard let label = activeLabel else { return }
    let now = FocuslingShared.nowMs()
    guard now - lastSavedMs >= intervalMs else { return }
    lastSavedMs = now
    let image = CIImage(cvPixelBuffer: pixelBuffer)
    guard let cg = context.createCGImage(image, from: image.extent),
          let jpeg = UIImage(cgImage: cg).jpegData(compressionQuality: 0.6) else { return }
    let dir = root.appendingPathComponent(label, isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    try? jpeg.write(to: dir.appendingPathComponent("\(Int(now)).jpg"), options: .completeFileProtection)
  }

  func counts() -> [String: Int] {
    var out: [String: Int] = [:]
    for label in Self.labels {
      let dir = root.appendingPathComponent(label, isDirectory: true)
      out[label] = (try? FileManager.default.contentsOfDirectory(atPath: dir.path).count) ?? 0
    }
    return out
  }

  @MainActor
  func export() {
    guard FileManager.default.fileExists(atPath: root.path), let presenter = FamilyControlsService.topViewController() else { return }
    presenter.present(UIActivityViewController(activityItems: [root], applicationActivities: nil), animated: true)
  }

  func deleteAll() {
    try? FileManager.default.removeItem(at: root)
  }
  #endif
}
