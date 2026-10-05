import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { PremiumStatusCard } from '@/features/premium/PremiumStatusCard';
import { DeveloperTools } from '@/features/settings/DeveloperTools';
import { ResetCard } from '@/features/settings/ResetCard';
import { SettingRow } from '@/features/settings/SettingRow';
import { TrustCard } from '@/features/settings/TrustCard';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { services } from '@/services';
import { useGameStore } from '@/state';
import { Button, Card, Screen, colors, typography } from '@/ui';

export default function SettingsScreen() {
  const settings = useGameStore((s) => s.save?.profile.settings);
  const updateSettings = useGameStore((s) => s.updateSettings);
  const reducedMotion = useReducedMotion();
  if (!settings) return null;

  return (
    <Screen scroll>
      <Text style={typography.title} accessibilityRole="header">
        Settings
      </Text>

      <PremiumStatusCard />

      <Card>
        <Text style={typography.heading}>Sound & feel</Text>
        <SettingRow label="Sound Effects" value={settings.soundEnabled} onChange={(v) => updateSettings({ soundEnabled: v })} />
        <SettingRow label="Haptics" value={settings.hapticsEnabled} onChange={(v) => updateSettings({ hapticsEnabled: v })} />
        <Text style={styles.muted}>Focus sessions stay quiet either way: no music, ambience or pet sounds while you focus.</Text>
      </Card>

      <Card>
        <Text style={typography.heading}>Motion</Text>
        <Text style={styles.muted}>
          {reducedMotion
            ? 'Reduce Motion is on, so Focusling uses gentle fades instead of bounces and particles.'
            : 'Focusling follows your device’s Reduce Motion setting. Turn it on in your device settings for calmer animation.'}
        </Text>
      </Card>

      <Card>
        <Text style={typography.heading}>Focus protection</Text>
        <Text style={styles.muted}>
          {services.protection.platform === 'mock'
            ? 'Simulated on this device: nothing is actually blocked.'
            : 'Protect Instagram during focus sessions: Reels only, or the entire app.'}
        </Text>
        <Button variant="secondary" label="Protection settings" onPress={() => router.push('/protection')} />
      </Card>

      <TrustCard />

      <ResetCard />

      <Card>
        <SettingRow label="Developer tools" value={settings.debugToolsEnabled} onChange={(v) => updateSettings({ debugToolsEnabled: v })} />
      </Card>
      {settings.debugToolsEnabled && <DeveloperTools />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { ...typography.body, fontSize: 14, color: colors.textMuted },
});
