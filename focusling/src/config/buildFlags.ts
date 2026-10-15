/**
 * Build-time switches. `EXPO_PUBLIC_*` values are inlined by Expo when the app
 * is built, so they can't be changed by a URL, a query parameter or local
 * storage at runtime.
 *
 * TEST PURCHASES (simulated Premium) are on only in:
 * - development builds (`__DEV__`), or
 * - a web/test build made with EXPO_PUBLIC_STUDYLING_TEST_PURCHASES=enabled.
 * Production builds leave both off: no test store, no tier overrides, and any
 * test-store entitlement left in storage is ignored.
 */
export const TEST_PURCHASES_ENABLED: boolean = (typeof __DEV__ !== 'undefined' && __DEV__ === true) || process.env.EXPO_PUBLIC_STUDYLING_TEST_PURCHASES === 'enabled';

/** Indirection so tests can model a production build. */
export function testPurchasesEnabled(): boolean {
  return TEST_PURCHASES_ENABLED;
}
