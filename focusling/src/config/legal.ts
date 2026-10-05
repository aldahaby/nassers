/**
 * Trust surfaces. ⚠️ Final hosted URLs are REQUIRED before App Store submission
 * (a privacy policy URL is mandatory for every app). Until they exist these are
 * null and the app says so honestly instead of linking to a fake page.
 */
export const LEGAL = {
  privacyPolicyUrl: null as string | null,
  termsUrl: null as string | null,
  supportUrl: null as string | null,
  /** Apple's standard EULA can be used for subscriptions if no custom Terms are provided. */
  appleStandardEulaUrl: 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
  supportEmail: null as string | null,
};

/** Plain statement of what is stored where (no account or backend exists). */
export const DATA_STATEMENT =
  'Focusling keeps your pet, progress and settings only on this device. There is no Focusling account and nothing is uploaded. Subscriptions are handled by Apple.';
