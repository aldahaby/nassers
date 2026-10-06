import { ImportSourceSheet } from '@/features/planner/ImportSourceSheet';
import { PlannerScreen } from '@/features/planner/PlannerScreen';

export default function PlannerImportScreen() {
  return (
    <PlannerScreen title="Add a course" subtitle="Studyling reads everything on this device.">
      <ImportSourceSheet />
    </PlannerScreen>
  );
}
