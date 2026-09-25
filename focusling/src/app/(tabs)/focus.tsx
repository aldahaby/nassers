import { EmptyState } from '@/ui';

// Placeholder until the focus milestone. Game logic for it already exists in `core/`.
export default function FocusScreen() {
  return <EmptyState icon="⏳" title="Focus sessions" body="Pick 15, 30, 45, 60 minutes or a custom length, then focus together with your pet. Coming in the next milestone." />;
}
