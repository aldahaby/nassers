import { router, type Href } from 'expo-router';
import { RetrievalPrompt } from '@/features/planner/RetrievalPrompt';
import { useHomeHref } from '@/state';
import { Screen } from '@/ui';

/** Shown after an eligible study session (once). */
export default function RetrievalScreen() {
  const home = useHomeHref();
  return (
    <Screen scroll>
      <RetrievalPrompt onDone={() => router.dismissTo((home === '/onboarding' ? '/' : home) as Href)} />
    </Screen>
  );
}
