/** Route targets used across screens. */
const ROUTES = { pet: '/(tabs)', focus: '/(tabs)/focus', shop: '/(tabs)/shop', missions: '/missions', play: '/(tabs)/play', planner: '/(tabs)/planner' } as const;

export function useAppRoutes() {
  return ROUTES;
}
