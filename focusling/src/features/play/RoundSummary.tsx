import { router, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import type { GameRoundResult } from '@/core';
import { useAppRoutes } from '@/hooks/useAppRoutes';
import { Button, Card, colors, spacing, typography } from '@/ui';
import { capReachedLine, rewardLine } from './playCopy';

interface Props {
  title: string;
  detail: string;
  result: GameRoundResult;
  petName: string;
  onPlayAgain: () => void;
}

/**
 * End of a round. "Play again" and "Back to pet" look exactly alike: no
 * pressure to keep going.
 */
export function RoundSummary({ title, detail, result, petName, onPlayAgain }: Props) {
  const routes = useAppRoutes();
  return (
    <Card style={styles.card}>
      <View accessible accessibilityRole="summary" accessibilityLiveRegion="polite" style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.detail}>{detail}</Text>
        <Text style={styles.reward}>{rewardLine(result, petName)}</Text>
        {result.capReached && (result.coins > 0 || result.happiness > 0) && <Text style={styles.detail}>{capReachedLine(petName)}</Text>}
      </View>
      <View style={styles.actions}>
        <Button variant="secondary" label="Play again" onPress={onPlayAgain} style={styles.action} />
        <Button variant="secondary" label={`Back to ${petName}`} onPress={() => router.dismissTo(routes.pet as Href)} style={styles.action} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg, alignItems: 'stretch' },
  text: { alignItems: 'center', gap: spacing.xs },
  title: { ...typography.heading, textAlign: 'center' },
  detail: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  reward: { ...typography.body, fontWeight: '800', color: '#1F8A55', textAlign: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { flexGrow: 1, flexBasis: 140 },
});
