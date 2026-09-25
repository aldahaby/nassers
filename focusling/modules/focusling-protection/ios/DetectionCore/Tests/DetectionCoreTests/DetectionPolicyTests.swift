import XCTest
@testable import DetectionCore

/// Runs the same vectors as src/core/__tests__/protection.test.ts.
final class DetectionPolicyTests: XCTestCase {
  struct Vectors: Decodable {
    struct Sample: Decodable { let at: Double; let surface: String; let confidence: Double }
    struct Case: Decodable { let name: String; let samples: [Sample]; let expectInterventionsAt: [Double] }
    let policy: DetectionPolicyConfig
    let cases: [Case]
  }

  func testSharedVectors() throws {
    let url = try XCTUnwrap(Bundle.module.url(forResource: "protectionVectors", withExtension: "json"))
    let vectors = try JSONDecoder().decode(Vectors.self, from: Data(contentsOf: url))
    for testCase in vectors.cases {
      var policy = DetectionPolicy(config: vectors.policy)
      var hits: [Double] = []
      for s in testCase.samples {
        let c = SurfaceClassification(app: .instagram, surface: s.surface == "reels" ? .instagramReels : .other, confidence: s.confidence)
        if policy.record(c, atMs: s.at) { hits.append(s.at) }
      }
      XCTAssertEqual(hits, testCase.expectInterventionsAt, testCase.name)
    }
  }

  func testScorerNeedsCombinedCues() {
    let rail = [TextObservation(text: "12.3K", x: 0.88, y: 0.55, width: 0.08, height: 0.02),
                TextObservation(text: "418", x: 0.88, y: 0.63, width: 0.06, height: 0.02)]
    let audio = TextObservation(text: "Original audio", x: 0.05, y: 0.88, width: 0.3, height: 0.02)
    let dm = TextObservation(text: "Message...", x: 0.1, y: 0.93, width: 0.5, height: 0.03)
    XCTAssertLessThan(ReelsLayoutScorer.classify(rail).confidence, 0.75)
    XCTAssertGreaterThanOrEqual(ReelsLayoutScorer.classify(rail + [audio]).confidence, 0.75)
    XCTAssertEqual(ReelsLayoutScorer.classify(rail + [audio, dm]).confidence, 0)
  }
}
