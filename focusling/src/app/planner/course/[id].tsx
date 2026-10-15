import { useLocalSearchParams } from 'expo-router';
import { CourseDetailScreen } from '@/features/planner/CourseDetail';
import { PlannerScreen } from '@/features/planner/PlannerScreen';

export default function CourseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <PlannerScreen title="Course">
      <CourseDetailScreen id={id} />
    </PlannerScreen>
  );
}
