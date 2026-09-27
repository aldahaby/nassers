import { PlayHub } from '@/features/play/PlayHub';
import { Screen } from '@/ui';

export default function ChildPlayScreen() {
  return (
    <Screen scroll>
      <PlayHub />
    </Screen>
  );
}
