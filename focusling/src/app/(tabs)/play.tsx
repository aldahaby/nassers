import { PlayHub } from '@/features/play/PlayHub';
import { Screen } from '@/ui';

/** Self mode Play tab (Family Mode uses the Child View tab). */
export default function PlayScreen() {
  return (
    <Screen scroll>
      <PlayHub />
    </Screen>
  );
}
