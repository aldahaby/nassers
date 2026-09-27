import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useAppRoutes } from '@/hooks/useAppRoutes';
import { useActiveSession, useGameStore, useMissionViews } from '@/state';
import { Button, Card, colors, spacing, typography } from '@/ui';
import { MissionCard } from './MissionCard';

/** Child View missions: read-only, encouraging, and one tap from a focus session. */
export function MissionList() {
  const views = useMissionViews().filter((v) => v.status !== 'inactive');
  const petName = useGameStore((s) => s.save?.pet?.name ?? 'your pet');
  const active = useActiveSession();
  const routes = useAppRoutes();
  const today = views.filter((v) => v.status === 'active' || v.status === 'complete');
  const later = views.filter((v) => v.status === 'notToday' || v.status === 'unavailable');

  return (
    <View style={styles.wrap}>
      {today.length === 0 ? (
        <Card>
          <Text style={typography.heading}>No missions today</Text>
          <Text style={styles.muted}>Every focus session still helps {petName} grow.</Text>
        </Card>
      ) : (
        today.map((view) => <MissionCard key={view.mission.id} view={view} />)
      )}
      <Button
        label={active ? 'Back to my session' : 'Start focusing'}
        icon="⏳"
        onPress={() => router.navigate(routes.focus)}
      />
      {later.length > 0 && (
        <>
          <Text style={styles.section}>Other days</Text>
          {later.map((view) => (
            <MissionCard key={view.mission.id} view={view} />
          ))}
        </>
      )}
      <Text style={styles.muted}>Missions reset each day. If one doesn’t happen, that’s okay: tomorrow is a fresh start.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  section: { ...typography.heading, marginTop: spacing.sm },
  muted: { ...typography.body, fontSize: 14, color: colors.textMuted },
});
