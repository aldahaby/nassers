import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useGameStore } from '@/state';
import { Button, spacing, typography } from '@/ui';

/**
 * Inventory/economy shortcuts. Only rendered when Settings → Developer tools is on.
 * None of these spend coins or count as purchases.
 */
export function InventoryDevTools() {
  const { debugGrant, debugClearInventory, debugUnlockAll, debugOwnOneOfEach, debugResetEquipped } = useGameStore.getState();
  const [message, setMessage] = useState<string | null>(null);
  const act = (label: string, fn: () => void) => () => {
    fn();
    setMessage(label);
  };
  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        <Button variant="secondary" label="+100 coins" onPress={act('Added 100 coins', () => debugGrant({ coins: 100 }))} style={styles.cell} />
        <Button variant="secondary" label="Clear inventory" onPress={act('Inventory cleared', debugClearInventory)} style={styles.cell} />
        <Button variant="secondary" label="Unlock all" onPress={act('Unlocked every item (5 of each food)', debugUnlockAll)} style={styles.cell} />
        <Button variant="secondary" label="One of each" onPress={act('Own exactly one of each item', debugOwnOneOfEach)} style={styles.cell} />
        <Button variant="secondary" label="Reset equipped" onPress={act('Took everything off', debugResetEquipped)} style={styles.cell} />
      </View>
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { flexGrow: 1, flexBasis: '45%' },
  message: { ...typography.label, fontSize: 12 },
});
