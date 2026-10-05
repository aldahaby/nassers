import { useState } from 'react';
import { Text, View } from 'react-native';
import { getProgression } from '@/core';
import { ProtectionDebugPanel } from '@/features/protection/ProtectionDebugPanel';
import { InventoryDevTools } from '@/features/shop/InventoryDevTools';
import { useGameStore } from '@/state';
import { Button, Card, typography } from '@/ui';
import { FamilyDevTools } from './FamilyDevTools';
import { PremiumDevTools } from './PremiumDevTools';
import { StyleDevTools } from './StyleDevTools';
import { devStyles } from './devStyles';

/** Shortcuts for testing progression, sessions and items. Hidden unless the setting is on. */
export function DeveloperTools() {
  const { debugGrant, debugPrimeXp, debugDressUp, startFocus, endFocus } = useGameStore.getState();
  const hasActive = useGameStore((s) => Boolean(s.save?.focus.active));
  const xp = useGameStore((s) => s.save?.pet?.lifetimeXp ?? 0);
  const coins = useGameStore((s) => s.save?.wallet.coins ?? 0);
  const progression = getProgression(xp);
  const [message, setMessage] = useState<string | null>(null);

  const simulate = async (outcome: 'completed' | 'abandoned') => {
    if (!hasActive) {
      const started = await startFocus(30);
      if (!started.ok) return setMessage(`Could not start: ${started.error}`);
    }
    const result = endFocus(outcome);
    setMessage(result.ok ? `${outcome}: +${result.value.coins} coins, +${result.value.xp} XP` : result.error);
  };

  return (
    <Card>
      <Text style={typography.heading}>🛠 Developer tools</Text>
      <Text style={styles.status} accessibilityLabel="Developer status">
        Lv {progression.level} · {progression.stage} · {xp} XP · {coins} coins
      </Text>
      <Text style={styles.muted}>Progress</Text>
      <View style={styles.grid}>
        <Button variant="secondary" label="+250 XP" onPress={() => debugGrant({ xp: 250 })} style={styles.cell} />
        <Button variant="secondary" label="Prime level-up" onPress={() => debugPrimeXp('levelUp')} style={styles.cell} />
        <Button variant="secondary" label="Prime growth" onPress={() => debugPrimeXp('nextStage')} style={styles.cell} />
        <Button variant="secondary" label="Prime evolution" onPress={() => debugPrimeXp('evolution')} style={styles.cell} />
      </View>
      <Text style={styles.muted}>Sessions (30 min)</Text>
      <View style={styles.grid}>
        <Button variant="secondary" label="Simulate success" onPress={() => void simulate('completed')} style={styles.cell} />
        <Button variant="secondary" label="Simulate abandon" onPress={() => void simulate('abandoned')} style={styles.cell} />
      </View>
      <Text style={styles.muted}>Items</Text>
      <InventoryDevTools />
      <Button
        variant="secondary"
        label="Dress up (own + equip one per slot)"
        onPress={() => {
          debugDressUp();
          setMessage('Equipped one item in every slot');
        }}
      />
      {message && <Text style={styles.muted}>{message}</Text>}
      <PremiumDevTools />
      <FamilyDevTools />
      <StyleDevTools />
      <ProtectionDebugPanel />
    </Card>
  );
}

const styles = devStyles;
