import { useLocalSearchParams } from 'expo-router';
import { PlannerScreen } from '@/features/planner/PlannerScreen';
import { ReminderSettings } from '@/features/planner/ReminderSettings';

export default function PlannerSettingsScreen() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  return (
    <PlannerScreen title={section === 'availability' ? 'Find more time' : 'Reminders & time'} subtitle={section === 'availability' ? 'Add study windows, then re-plan.' : undefined}>
      <ReminderSettings section={section} />
    </PlannerScreen>
  );
}
