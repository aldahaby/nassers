import Foundation

/// Surfaces the detector can report. Raw values match the TypeScript `ContentSurface`.
public enum ContentSurface: String, Codable, Sendable {
  case instagramReels, instagramStories, instagramExplore, youtubeShorts, other
}

public struct SurfaceClassification: Equatable, Sendable {
  public enum App: String, Sendable { case instagram, unknown }
  public let app: App
  public let surface: ContentSurface
  public let confidence: Double
  public init(app: App, surface: ContentSurface, confidence: Double) {
    self.app = app
    self.surface = surface
    self.confidence = confidence
  }
  public static let nothing = SurfaceClassification(app: .unknown, surface: .other, confidence: 0)
}

/// Configurable temporal confirmation. Values arrive from JS (`config/protection.ts`).
public struct DetectionPolicyConfig: Codable, Equatable, Sendable {
  public var confidenceThreshold: Double
  public var requiredVotes: Int
  public var windowSize: Int
  public var minimumDetectionMs: Double
  public var cooldownMs: Double

  public init(confidenceThreshold: Double = 0.75, requiredVotes: Int = 3, windowSize: Int = 5, minimumDetectionMs: Double = 1500, cooldownMs: Double = 20_000) {
    self.confidenceThreshold = confidenceThreshold
    self.requiredVotes = requiredVotes
    self.windowSize = windowSize
    self.minimumDetectionMs = minimumDetectionMs
    self.cooldownMs = cooldownMs
  }

  public init(dictionary: [String: Double]) {
    let d = DetectionPolicyConfig()
    self.init(
      confidenceThreshold: dictionary["confidenceThreshold"] ?? d.confidenceThreshold,
      requiredVotes: Int(dictionary["requiredVotes"] ?? Double(d.requiredVotes)),
      windowSize: Int(dictionary["windowSize"] ?? Double(d.windowSize)),
      minimumDetectionMs: dictionary["minimumDetectionMs"] ?? d.minimumDetectionMs,
      cooldownMs: dictionary["cooldownMs"] ?? d.cooldownMs
    )
  }
}

/// Rolling-window vote. Mirrors `src/core/protection/detectionPolicy.ts` exactly;
/// both are checked against `protectionVectors.json`.
public struct DetectionPolicy: Sendable {
  public private(set) var config: DetectionPolicyConfig
  public let target: ContentSurface
  /// Timestamp (ms) of each positive sample, or nil for a negative; oldest first.
  private var samples: [Double?] = []
  private var cooldownUntil: Double = 0

  public init(config: DetectionPolicyConfig, target: ContentSurface = .instagramReels) {
    self.config = config
    self.target = target
  }

  public var votes: Int { samples.compactMap { $0 }.count }

  public mutating func reset() {
    samples = []
    cooldownUntil = 0
  }

  /// Returns true when an intervention should happen now.
  public mutating func record(_ classification: SurfaceClassification, atMs at: Double) -> Bool {
    if at < cooldownUntil {
      samples = []
      return false
    }
    let positive = classification.surface == target && classification.confidence >= config.confidenceThreshold
    samples.append(positive ? at : nil)
    if samples.count > config.windowSize { samples.removeFirst(samples.count - config.windowSize) }

    let positives = samples.compactMap { $0 }
    let span = (positives.last ?? 0) - (positives.first ?? 0)
    if positives.count >= config.requiredVotes && span >= config.minimumDetectionMs {
      samples = []
      cooldownUntil = at + config.cooldownMs
      return true
    }
    return false
  }
}
