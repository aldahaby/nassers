/**
 * The app clock. Production reads the device time; Planner QA (Developer tools
 * only) can shift it to rehearse a semester. The offset lives in memory and
 * resets on reload; it is refused unless Developer tools are on.
 */
let offsetMs = 0;
const listeners = new Set<() => void>();

export const appClock = {
  now: () => Date.now() + offsetMs,
  offset: () => offsetMs,
  setOffset(ms: number, devToolsEnabled: boolean) {
    if (!devToolsEnabled) return;
    offsetMs = ms;
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};
