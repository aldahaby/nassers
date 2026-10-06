import ExpoModulesCore
import Foundation
import PDFKit
import UIKit
import Vision
import WidgetKit
#if canImport(ActivityKit)
import ActivityKit
#endif

/// Live Activity content sent from JS (already privacy-filtered).
struct LiveActivityPayload: Record {
  @Field var title: String = "Studyling"
  @Field var subtitle: String = ""
  @Field var endsAtMs: Double = 0
  @Field var protection: String = "off"
}

/**
 * Studyling planner native module. UNTESTED until an EAS development build runs it.
 *
 * - extractPdfText: embedded PDF text first (PDFKit); pages without usable text are
 *   rendered and read with on-device Vision text recognition. Runs off the main thread,
 *   page by page, reporting progress. Nothing is uploaded and no text is logged.
 *   An in-memory cache (process lifetime only, never written to disk) avoids
 *   re-reading the same file twice in one session.
 * - writeWidgetSnapshot: stores the minimal widget JSON in the App Group and reloads widgets.
 * - start/update/endLiveActivity: the study-session Live Activity.
 */
public class StudylingNativeModule: Module {
  private static var ocrCache: [String: [[String: Any]]] = [:]
  private static var cacheOrder: [String] = []
  private static let cacheLock = NSLock()

  public func definition() -> ModuleDefinition {
    Name("StudylingNative")
    Events("onExtractionProgress")

    AsyncFunction("extractPdfText") { (uri: String, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        guard let url = URL(string: uri), let data = try? Data(contentsOf: url), let doc = PDFDocument(data: data) else {
          promise.reject("E_UNREADABLE", "The document could not be opened.")
          return
        }
        let key = Self.cacheKey(data)
        Self.cacheLock.lock()
        let hit = Self.ocrCache[key]
        Self.cacheLock.unlock()
        if let cached = hit {
          promise.resolve(cached)
          return
        }
        let total = min(doc.pageCount, 80)
        var pages: [[String: Any]] = []
        for i in 0..<total {
          autoreleasepool {
            guard let page = doc.page(at: i) else { return }
            let embedded = page.string ?? ""
            let usable = embedded.trimmingCharacters(in: .whitespacesAndNewlines).count >= 20
            if usable {
              pages.append(["index": i, "text": embedded, "method": "embeddedText"])
            } else {
              pages.append(["index": i, "text": Self.recognizeText(page), "method": "ocr"])
            }
            self.sendEvent("onExtractionProgress", ["done": i + 1, "total": total])
          }
        }
        Self.remember(key, pages)
        promise.resolve(pages)
      }
    }

    AsyncFunction("writeWidgetSnapshot") { (json: String) in
      UserDefaults(suiteName: StudylingShared.appGroup)?.set(json, forKey: StudylingShared.snapshotKey)
      WidgetCenter.shared.reloadAllTimelines()
    }

    Function("liveActivitiesEnabled") { () -> Bool in
      if #available(iOS 16.2, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    AsyncFunction("startLiveActivity") { (payload: LiveActivityPayload) -> String? in
      guard #available(iOS 16.2, *) else { return nil }
      let state = Self.state(payload)
      let activity = try Activity.request(
        attributes: StudylingActivityAttributes(),
        content: .init(state: state, staleDate: state.endsAt),
        pushType: nil
      )
      return activity.id
    }

    AsyncFunction("updateLiveActivity") { (id: String, payload: LiveActivityPayload) in
      guard #available(iOS 16.2, *) else { return }
      let state = Self.state(payload)
      for activity in Activity<StudylingActivityAttributes>.activities where activity.id == id {
        await activity.update(.init(state: state, staleDate: state.endsAt))
      }
    }

    AsyncFunction("endLiveActivity") { (id: String) in
      guard #available(iOS 16.2, *) else { return }
      for activity in Activity<StudylingActivityAttributes>.activities where activity.id == id {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
    }
  }

  @available(iOS 16.1, *)
  private static func state(_ p: LiveActivityPayload) -> StudylingActivityAttributes.ContentState {
    StudylingActivityAttributes.ContentState(title: p.title, subtitle: p.subtitle, endsAt: Date(timeIntervalSince1970: p.endsAtMs / 1000), protection: p.protection)
  }

  /// On-device OCR for one page (Vision). Returns lines top to bottom.
  private static func recognizeText(_ page: PDFPage) -> String {
    let bounds = page.bounds(for: .mediaBox)
    let scale: CGFloat = 2
    let size = CGSize(width: bounds.width * scale, height: bounds.height * scale)
    guard let cgImage = page.thumbnail(of: size, for: .mediaBox).cgImage else { return "" }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    do {
      try handler.perform([request])
    } catch {
      return ""
    }
    let observations = (request.results ?? []).sorted { $0.boundingBox.minY > $1.boundingBox.minY }
    return observations.compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
  }

  private static func cacheKey(_ data: Data) -> String {
    // Cheap identity for the in-memory cache: size + a sample of bytes. Not persisted.
    var hasher = Hasher()
    hasher.combine(data.count)
    hasher.combine(data.prefix(4096))
    hasher.combine(data.suffix(4096))
    return String(hasher.finalize())
  }

  private static func remember(_ key: String, _ pages: [[String: Any]]) {
    cacheLock.lock()
    defer { cacheLock.unlock() }
    ocrCache[key] = pages
    cacheOrder.append(key)
    if cacheOrder.count > 3 {
      let old = cacheOrder.removeFirst()
      ocrCache.removeValue(forKey: old)
    }
  }
}
