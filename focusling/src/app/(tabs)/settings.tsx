import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { SHOP_ITEMS } from '@/config/shopCatalog';
import { services } from '@/services';
import { useGameStore } from '@/state';
import { Button, Card, Screen, colors, spacing, typography } from '@/ui';

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
        <Text style={typography.heading}>App blocking</Text>
        <Text style={styles.muted}>
          Blocking mode: {services.screenTime.kind === 'mock' ? 'Simulated (prototype)' : services.screenTime.kind}. Real
          iOS and Android app blocking arrives in a later milestone.
        </Text>
      </Card>
      {settings.debugToolsEnabled && <DeveloperTools />}
      <ResetCard />
    </Screen>
  );
}

function SettingRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={typography.body}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={colors.white} accessibilityLabel={label} />
    </View>
  );
}

/** Shortcuts for exercising progression and cosmetics before their screens exist. */
function DeveloperTools() {
  const { debugGrant, startFocus, endFocus, purchase, equip } = useGameStore.getState();
  const hasActive = useGameStore((s) => Boolean(s.save?.focus.active));
  const [message, setMessage] = useState<string | null>(null);

  const simulate = (outcome: 'completed' | 'abandoned') => {
    if (!hasActive) {
      const started = startFocus(30, []);
      if (!started.ok) return setMessage(`Could not start: ${started.error}`);
    }
    const result = endFocus(outcome);
    setMessage(result.ok ? `${outcome}: +${result.value.coins} coins, +${result.value.xp} XP` : result.error);
  };

  const dressUp = () => {
    debugGrant({ coins: 1000 });
    for (const item of SHOP_ITEMS) {
      if (item.equipSlot && item.id !== 'decor-beanbag') {
        purchase(item.id);
        equip(item.id);
      }
    }
    setMessage('Bought and equipped a starter wardrobe');
  };

  return (
    <Card>
      <Text style={typography.heading}>🛠 Developer tools</Text>
      <View style={styles.grid}>
        <Button variant="secondary" label="+100 coins" onPress={() => debugGrant({ coins: 100 })} style={styles.cell} />
        <Button variant="secondary" label="+250 XP" onPress={() => debugGrant({ xp: 250 })} style={styles.cell} />
        <Button variant="secondary" label="Simulate success" onPress={() => simulate('completed')} style={styles.cell} />
        <Button variant="secondary" label="Simulate abandon" onPress={() => simulate('abandoned')} style={styles.cell} />
      </View>
      <Button variant="secondary" label="Dress up (buy + equip all)" onPress={dressUp} />
      {message && <Text style={styles.muted}>{message}</Text>}
    </Card>
  );
}

function ResetCard() {
  const resetProgress = useGameStore((s) => s.resetProgress);
  const [confirming, setConfirming] = useState(false);
  return (
    <Card>
      <Text style={typography.heading}>Start over</Text>
      <Text style={styles.muted}>Erases your pet, coins, items and stats on this device.</Text>
      {confirming ? (
        <View style={styles.grid}>
          <Button variant="ghost" label="Cancel" onPress={() => setConfirming(false)} style={styles.cell} />
          <Button variant="danger" label="Erase" onPress={() => void resetProgress()} style={styles.cell} />
        </View>
      ) : (
        <Button variant="ghost" label="Reset progress…" onPress={() => setConfirming(true)} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  muted: { ...typography.body, fontSize: 14, color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { flexGrow: 1, flexBasis: '45%' },
});
