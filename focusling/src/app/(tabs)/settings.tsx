import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { DeveloperTools } from '@/features/settings/DeveloperTools';
import { ResetCard } from '@/features/settings/ResetCard';
import { SettingRow } from '@/features/settings/SettingRow';
import { services } from '@/services';
import { useGameStore } from '@/state';
import { Button, Card, Screen, colors, typography } from '@/ui';

export default function SettingsScreen() {
  const settings = useGameStore((s) => s.save?.profile.settings);
  const updateSettings = useGameStore((s) => s.updateSettings);
  if (!settings) return null;

  return (
    <Screen scroll>
      <Text style={typography.title}>Settings</Text>
      <Card>
        <SettingRow label="Haptics" value={settings.hapticsEnabled} onChange={(v) => updateSettings({ hapticsEnabled: v })} />
        <SettingRow label="Sounds" value={settings.soundEnabled} onChange={(v) => updateSettings({ soundEnabled: v })} />
        <SettingRow
          label="Developer tools"
          value={settings.debugToolsEnabled}
          onChange={(v) => updateSettings({ debugToolsEnabled: v })}
        />
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
      {settings.debugToolsEnabled && <DeveloperTools />}
      <ResetCard />
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { ...typography.body, fontSize: 14, color: colors.textMuted },
});
