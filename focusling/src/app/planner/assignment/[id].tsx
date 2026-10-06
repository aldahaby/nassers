import { useLocalSearchParams } from 'expo-router';
import { AssignmentDetail } from '@/features/planner/AssignmentDetail';
import { PlannerScreen } from '@/features/planner/PlannerScreen';

export default function AssignmentScreen() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  return (
    <PlannerScreen title="Assignment">
      <AssignmentDetail id={id} editEstimate={edit === 'estimate'} />
    </PlannerScreen>
  );
}
