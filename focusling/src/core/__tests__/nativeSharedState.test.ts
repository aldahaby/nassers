import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('native sources stay in sync', () => {
  it('every extension uses an identical copy of FocuslingSharedState.swift', () => {
    const canonical = read('modules/focusling-protection/ios/Shared/FocuslingSharedState.swift');
    for (const target of ['shield-config', 'shield-action', 'device-activity']) {
      expect(read(`targets/${target}/FocuslingSharedState.swift`)).toBe(canonical);
    }
  });

  it('the Swift DetectionCore tests use the same vectors as the TypeScript tests', () => {
    expect(JSON.parse(read('modules/focusling-protection/ios/DetectionCore/Tests/DetectionCoreTests/protectionVectors.json'))).toEqual(
      JSON.parse(read('src/config/protectionVectors.json')),
    );
  });

  it('the Swift default policy matches the app config', () => {
    const swift = read('modules/focusling-protection/ios/DetectionCore/Sources/DetectionCore/DetectionPolicy.swift');
    expect(swift).toContain('confidenceThreshold: Double = 0.75, requiredVotes: Int = 3, windowSize: Int = 5, minimumDetectionMs: Double = 1500, cooldownMs: Double = 20_000');
  });
});
