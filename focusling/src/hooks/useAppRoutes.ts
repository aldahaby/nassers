import { useGameStore } from '@/state';

/** Route targets for the current mode (self tabs vs. Child View tabs). The Planner is a Self Mode (student) destination. */
export function useAppRoutes() {
  const family = useGameStore((s) => s.save?.mode === 'family');
  return family
    ? ({ pet: '/(child)', focus: '/(child)/focus', shop: '/(child)/shop', missions: '/(child)/missions', play: '/(child)/play', planner: '/(child)' } as const)
    : ({ pet: '/(tabs)', focus: '/(tabs)/focus', shop: '/(tabs)/shop', missions: '/missions', play: '/(tabs)/play', planner: '/(tabs)/planner' } as const);
}
