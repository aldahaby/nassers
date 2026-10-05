import { useState } from 'react';
import { Text, View } from 'react-native';
import { useGameStore } from '@/state';
import { Button, Card, typography } from '@/ui';
import { devStyles as styles } from './devStyles';

export function ResetCard() {
  const resetProgress = useGameStore((s) => s.resetProgress);
  const [confirming, setConfirming] = useState(false);
  return (
    <Card>
      <Text style={typography.heading}>Erase local data</Text>
      <Text style={styles.muted}>
        Erases the pet, coins, items, missions, stats and family settings stored on this device. Focusling has no account or server copy, so this can’t be undone. A Premium
        subscription is with Apple and isn’t affected; cancel it in Manage subscription.
      </Text>
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

