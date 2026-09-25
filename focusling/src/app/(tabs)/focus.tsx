import { ActiveSession } from '@/features/focus/ActiveSession';
import { FocusSetup } from '@/features/focus/FocusSetup';
import { useActiveSession } from '@/state';

/** The Focus tab: setup when idle, the calm countdown while a session runs. */
export default function FocusScreen() {
  const active = useActiveSession();
  return active ? <ActiveSession /> : <FocusSetup />;
}
