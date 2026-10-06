import { PlannerScreen } from '@/features/planner/PlannerScreen';
import { SyllabusReview } from '@/features/planner/SyllabusReview';

export default function PlannerReviewScreen() {
  return (
    <PlannerScreen title="Review syllabus" subtitle="Check anything uncertain. Nothing is planned until you add it.">
      <SyllabusReview />
    </PlannerScreen>
  );
}
