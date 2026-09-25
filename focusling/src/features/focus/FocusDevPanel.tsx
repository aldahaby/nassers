import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getProgression } from '@/core';
import { MockScreenTimeService, services } from '@/services';
import { useGameStore } from '@/state';
import { Button, colors, radius, spacing, typography } from '@/ui';

/**
 * Shortcuts for testing the focus loop. Rendered only when the "Developer tools"
 * setting is on, which is off by default outside development builds.
 */
export function FocusDevPanel({ mode }: { mode: 'setup' | 'active' }) {
  const [open, setOpen] = useState(false);
  const xp = useGameStore((s) => s.save?.pet?.lifetimeXp ?? 0);
  const { startFocus, endFocus, debugPrimeXp, debugSetRemaining } = useGameStore.getState();
  const progression = getProgression(xp);

  const startNearComplete = () => {
    if (startFocus(15, []).ok) debugSetRemaining(8_000);
  };
  const simulateViolation = () => {
    if (services.screenTime instanceof MockScreenTimeService) services.screenTime.simulateViolation();
  };

  return (
    <View style={styles.panel}>
      <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Text style={styles.header}>
          🛠 Developer tools {open ? '▾' : '▸'}
        </Text>
      </Pressable>
      {open && (
        <View style={styles.body}>
          <Text style={styles.meta}>
            Lv {progression.level} · {progression.stage} · {xp} XP
          </Text>
          {mode === 'setup' ? (
            <View style={styles.grid}>
              <Button variant="secondary" label="Start 15m, 8s left" onPress={startNearComplete} style={styles.cell} />
              <Button variant="secondary" label="Prime level-up" onPress={() => debugPrimeXp('levelUp')} style={styles.cell} />
              <Button variant="secondary" label="Prime growth" onPress={() => debugPrimeXp('nextStage')} style={styles.cell} />
              <Button variant="secondary" label="Prime evolution" onPress={() => debugPrimeXp('evolution')} style={styles.cell} />
            </View>
          ) : (
            <View style={styles.grid}>
              <Button variant="secondary" label="Skip to 8s left" onPress={() => debugSetRemaining(8_000)} style={styles.cell} />
              <Button variant="secondary" label="Complete now" onPress={() => endFocus('completed')} style={styles.cell} />
              <Button variant="secondary" label="Simulate app opened" onPress={simulateViolation} style={styles.cell} />
              <Button variant="secondary" label="Prime level-up" onPress={() => debugPrimeXp('levelUp')} style={styles.cell} />
            </View>
          )}
          <Text style={styles.meta}>
            “Prime” sets XP one short of the milestone, so the next session crosses it.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  header: { ...typography.label, color: colors.textMuted },
  body: { gap: spacing.sm },
  meta: { ...typography.label, fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { flexGrow: 1, flexBasis: '45%' },
});
