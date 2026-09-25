import type { BlockTarget } from '@/core/models';

/**
 * Sample targets for the mock Screen Time service. On real devices these come
 * from the OS picker (iOS FamilyActivityPicker) or the installed-app list (Android).
 */
export const SAMPLE_DISTRACTING_APPS: readonly BlockTarget[] = [
  { id: 'instagram', displayName: 'Instagram', platformToken: 'com.instagram.android' },
  { id: 'tiktok', displayName: 'TikTok', platformToken: 'com.zhiliaoapp.musically' },
  { id: 'youtube', displayName: 'YouTube Shorts', platformToken: 'com.google.android.youtube' },
  { id: 'snapchat', displayName: 'Snapchat', platformToken: 'com.snapchat.android' },
  { id: 'x', displayName: 'X', platformToken: 'com.twitter.android' },
  { id: 'reddit', displayName: 'Reddit', platformToken: 'com.reddit.frontpage' },
];
