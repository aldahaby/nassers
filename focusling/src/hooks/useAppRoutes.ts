import { useGameStore } from '@/state';

/** Route targets for the current mode (self tabs vs. Child View tabs). */
export function useAppRoutes() {
  const family = useGameStore((s) => s.save?.mode === 'family');
  return family
    ? ({ pet: '/(child)', focus: '/(child)/focus', shop: '/(child)/shop', missions: '/(child)/missions', play: '/(child)/play' } as const)
    : ({ pet: '/(tabs)', focus: '/(tabs)/focus', shop: '/(tabs)/shop', missions: '/missions', play: '/(tabs)/play' } as const);
}
