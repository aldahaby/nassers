import { useLocalSearchParams } from 'expo-router';
import { ManualEntry } from '@/features/planner/ManualEntry';
import { PlannerScreen } from '@/features/planner/PlannerScreen';

export default function PlannerManualScreen() {
  const { course } = useLocalSearchParams<{ course?: string }>();
  return (
    <PlannerScreen title="Enter manually" subtitle="A course and its deadlines, in your own words.">
      <ManualEntry courseId={course} />
    </PlannerScreen>
  );
}
