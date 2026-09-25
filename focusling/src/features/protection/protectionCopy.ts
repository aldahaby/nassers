import type { ProtectionMode, ProtectionStartError, ReconcileNotice } from '@/core';

export const MODE_LABEL: Record<ProtectionMode, string> = {
  none: 'Off',
  selective: 'Reels only',
  wholeApp: 'Entire app',
};

export const SCREEN_TIME_EXPLAINER = 'Lets Focusling apply protection to the apps you choose, using Apple Screen Time.';
export const SCREEN_RECOGNITION_EXPLAINER =
  'Lets Focusling recognize Reels on your screen while a focus session is running. Processing stays on your iPhone.';
export const PRIVACY_NOTE =
  'Focusling looks at screen frames on your device to recognize Reels. Nothing is uploaded or saved, and iOS shows its recording indicator while this is on.';

export function startErrorMessage(error: ProtectionStartError | string): string {
  switch (error) {
    case 'screen-time-not-authorized':
      return 'Screen Time access is needed first.';
    case 'no-apps-selected':
      return 'Choose the app to protect first.';
    case 'screen-recognition-unavailable':
      return "Reels-only protection isn't active: screen recognition isn't available.";
    case 'capture-not-confirmed':
      return "Reels-only protection isn't active: screen recognition didn't start.";
    case 'native-error':
      return "Protection couldn't start.";
    default:
      return "That session couldn't start.";
  }
}

/** True when offering "Block Instagram entirely instead" makes sense. */
export function isSelectiveFailure(error: ProtectionStartError | string): boolean {
  return error === 'screen-recognition-unavailable' || error === 'capture-not-confirmed' || error === 'native-error';
}

export const NOTICE_COPY: Record<Exclude<ReconcileNotice, null>, { title: string; body: string }> = {
  'reels-protection-stopped': {
    title: 'Reels protection stopped',
    body: 'Screen recognition is no longer running. Your session and rewards are unaffected.',
  },
  'app-protection-stopped': {
    title: 'App protection stopped',
    body: 'The app shield is no longer applied. Your session and rewards are unaffected.',
  },
  'authorization-lost': {
    title: 'Screen Time access was turned off',
    body: 'Protection is paused. Your session keeps going.',
  },
};
