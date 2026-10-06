import { router, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import type { Assignment, CapacityWarning, PlannerState } from '@/core';
import { usePlannerStore } from '@/state';
import { Button, colors, radius, spacing } from '@/ui';
import { formatDay, formatMinutes } from './plannerCopy';

/**
 * Remaining work is bigger than the study time that fits before the deadline.
 * Calm wording, three choices, no red "failure" state.
 */
export function CapacityNote({ planner, assignment, warning, now }: { planner: PlannerState; assignment: Assignment; warning: CapacityWarning; now: number }) {
  const tz = planner.preferences.timezone;
  const text = `You estimated about ${formatMinutes(warning.neededMinutes)} remaining for ${assignment.title}, but only ${formatMinutes(warning.fitsMinutes)} currently fits before ${formatDay(warning.dueAt, tz, now)}.`;
  return (
    <View style={styles.box} accessible accessibilityLabel={text}>
      <Text style={styles.text}>{text}</Text>
      <View style={styles.actions}>
        <Button label="Find more time" variant="secondary" onPress={() => router.push('/planner/settings?section=availability' as Href)} style={styles.action} />
        <Button label="Change estimate" variant="secondary" onPress={() => router.push(`/planner/assignment/${assignment.id}?edit=estimate` as Href)} style={styles.action} />
        <Button label="I’ll handle it" variant="ghost" onPress={() => usePlannerStore.getState().dismissCapacityNote(assignment.id)} style={styles.action} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#FFF8EC', borderRadius: radius.lg, borderWidth: 1, borderColor: '#F3DDB4', padding: spacing.md, gap: spacing.sm },
  text: { fontSize: 15, lineHeight: 21, color: colors.text },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { flexGrow: 1, flexBasis: 130 },
});
