import { useLocalSearchParams } from 'expo-router';
import { PlannerCalendar } from '@/features/planner/PlannerCalendar';
import { PlannerScreen } from '@/features/planner/PlannerScreen';

export default function PlannerWeekScreen() {
  const { day } = useLocalSearchParams<{ day?: string }>();
  return (
    <PlannerScreen title="This week" width="wide">
      <PlannerCalendar initialDay={day} />
    </PlannerScreen>
  );
}
