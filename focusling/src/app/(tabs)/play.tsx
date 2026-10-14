import { PlayHub } from '@/features/play/PlayHub';
import { Screen } from '@/ui';

/** Play (opened from the Pet screen; hidden from the tab bar). */
export default function PlayScreen() {
  return (
    <Screen scroll>
      <PlayHub />
    </Screen>
  );
}
