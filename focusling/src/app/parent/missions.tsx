import { ParentHeader } from '@/features/family/ParentHeader';
import { MissionManager } from '@/features/missions/MissionManager';
import { useGameStore } from '@/state';
import { Screen } from '@/ui';

export default function ParentMissionsScreen() {
  const nickname = useGameStore((s) => s.save?.family?.child.nickname || 'your child');
  return (
    <Screen scroll>
      <ParentHeader title="Missions" subtitle={`Daily goals for ${nickname}. Rewards add to what focus sessions already earn.`} />
      <MissionManager audience="parent" />
    </Screen>
  );
}
