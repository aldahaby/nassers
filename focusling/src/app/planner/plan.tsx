import { useLocalSearchParams } from 'expo-router';
import { PlannerScreen } from '@/features/planner/PlannerScreen';
import { PlanStudy } from '@/features/planner/PlanStudy';

export default function PlanStudyScreen() {
  const { assignment } = useLocalSearchParams<{ assignment?: string }>();
  return (
    <PlannerScreen title="Plan a study session" subtitle="Your estimate, Studyling’s suggestion, your decision.">
      <PlanStudy initialId={assignment} />
    </PlannerScreen>
  );
}
