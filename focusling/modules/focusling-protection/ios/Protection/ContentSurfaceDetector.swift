import CoreVideo
import Vision

/// Replaceable on-device classifier: frame in, surface out. Frames never leave
/// this process and are not retained after `classify` returns.
protocol ContentSurfaceDetector {
  func classify(_ pixelBuffer: CVPixelBuffer) -> SurfaceClassification
}

/// First POC detector: Vision text recognition (fast mode) feeding
/// `ReelsLayoutScorer`. Recognised text is matched against fixed UI strings in
/// memory and discarded; it is never logged or stored. Not production-ready:
/// it will be replaced by our own Core ML classifier trained on consented,
/// self-collected samples.
final class VisionReelsDetector: ContentSurfaceDetector {
  func classify(_ pixelBuffer: CVPixelBuffer) -> SurfaceClassification {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .fast
    request.usesLanguageCorrection = false
    request.minimumTextHeight = 0.012
    let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: .up, options: [:])
    do {
      try handler.perform([request])
    } catch {
      return .nothing
    }
    let observations: [TextObservation] = (request.results ?? []).compactMap { o in
      guard let candidate = o.topCandidates(1).first else { return nil }
      let b = o.boundingBox // normalised, origin bottom-left
      return TextObservation(text: candidate.string, x: b.minX, y: 1 - b.maxY, width: b.width, height: b.height)
    }
    return ReelsLayoutScorer.classify(observations)
  }
}
