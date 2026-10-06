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

  it('the widget extension uses an identical copy of StudylingActivityAttributes.swift (Live Activity type)', () => {
    expect(read('targets/widgets/StudylingActivityAttributes.swift')).toBe(read('modules/studyling-native/ios/Shared/StudylingActivityAttributes.swift'));
  });

  it('the widget decodes exactly the snapshot fields the app writes, from the same App Group', () => {
    const swift = read('targets/widgets/StudylingWidgetModels.swift');
    for (const key of ['v', 'generatedAt', 'privacyMode', 'nextPlanId', 'courseDisplayName', 'assignmentDisplayTitle', 'plannedStart', 'plannedMinutes', 'todayPlanCount', 'todayMinutes', 'activeSession', 'pet']) {
      expect(swift).toMatch(new RegExp(`let ${key}:`));
    }
    const appGroup = JSON.parse(read('app.json')).expo.ios.entitlements['com.apple.security.application-groups'][0];
    expect(read('modules/studyling-native/ios/Shared/StudylingActivityAttributes.swift')).toContain(`appGroup = "${appGroup}"`);
    expect(read('targets/widgets/expo-target.config.js')).toContain("bundleIdentifier: '.widgets'");
    expect(JSON.parse(read('app.json')).expo.ios.infoPlist.NSSupportsLiveActivities).toBe(true);
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
