import Foundation

/// A recognised piece of on-screen text with its normalised bounding box
/// (0–1, origin top-left). Produced by Vision in the app; kept in memory only.
public struct TextObservation: Sendable {
  public let text: String
  public let x: Double, y: Double, width: Double, height: Double
  public init(text: String, x: Double, y: Double, width: Double, height: Double) {
    self.text = text
    self.x = x
    self.y = y
    self.width = width
    self.height = height
  }
  var midX: Double { x + width / 2 }
  var midY: Double { y + height / 2 }
}

/// First-POC Reels scorer: layout + UI-text heuristics, **not** an ML model and
/// not production-ready. It deliberately does not fire on "vertical video"
/// alone; it looks for the combination of cues specific to the Reels viewer.
/// Text is only matched against fixed UI strings and is never stored or logged.
public enum ReelsLayoutScorer {
  public struct Cues: Equatable, Sendable {
    public var reelsHeader = false       // "Reels" label in the top band
    public var engagementRail = false    // ≥2 short count labels on the right edge (likes/comments/shares)
    public var audioLine = false         // "Original audio" / "♫" style attribution in the bottom band
    public var followNearCaption = false // "Follow" beside a caption in the bottom band
    public var messagingChrome = false   // DM composer / inbox chrome ("Message…", "Send", "Messages")
    public var feedChrome = false        // feed header ("Instagram", "For you", "Following") near the top
  }

  static let countPattern = try! NSRegularExpression(pattern: "^[0-9][0-9.,]*[KkMm万]?$")

  public static func cues(from observations: [TextObservation]) -> Cues {
    var c = Cues()
    var rightRailCounts = 0
    for o in observations {
      let t = o.text.trimmingCharacters(in: .whitespacesAndNewlines)
      let lower = t.lowercased()
      if o.midY < 0.14 && lower == "reels" { c.reelsHeader = true }
      if o.midY < 0.14 && (lower == "instagram" || lower == "following" || lower == "for you") { c.feedChrome = true }
      if o.midX > 0.82 && o.midY > 0.35 && o.midY < 0.92 && o.width < 0.18,
         countPattern.firstMatch(in: t, range: NSRange(t.startIndex..., in: t)) != nil {
        rightRailCounts += 1
      }
      if o.midY > 0.70 && (lower.contains("original audio") || lower.contains("♫") || lower.contains("♪")) { c.audioLine = true }
      if o.midY > 0.68 && lower == "follow" { c.followNearCaption = true }
      if lower.hasPrefix("message") || lower == "send" || lower == "messages" || lower == "requests" { c.messagingChrome = true }
    }
    c.engagementRail = rightRailCounts >= 2
    return c
  }

  /// Confidence that the frame shows the Instagram Reels viewer.
  public static func score(_ c: Cues) -> Double {
    if c.messagingChrome { return 0 }
    var s = 0.0
    if c.engagementRail { s += 0.40 }
    if c.audioLine { s += 0.30 }
    if c.reelsHeader { s += 0.20 }
    if c.followNearCaption { s += 0.15 }
    if c.feedChrome { s -= 0.35 }
    // Guard against a single strong cue: need the rail plus one bottom-band cue.
    if !(c.engagementRail && (c.audioLine || c.followNearCaption)) { s = min(s, 0.6) }
    return max(0, min(1, s))
  }

  public static func classify(_ observations: [TextObservation]) -> SurfaceClassification {
    let confidence = score(cues(from: observations))
    return SurfaceClassification(app: confidence > 0 ? .instagram : .unknown, surface: confidence > 0 ? .instagramReels : .other, confidence: confidence)
  }
}
