import type { Id, Timestamp } from './common';

export interface UserSettings {
  hapticsEnabled: boolean;
  soundEnabled: boolean;
  /** Shows developer controls (simulate success/abandon, grant coins). */
  debugToolsEnabled: boolean;
}

export interface UserProfile {
  id: Id;
  createdAt: Timestamp;
  /** Null until the user finishes onboarding (chose and named a pet). */
  onboardingCompletedAt: Timestamp | null;
  settings: UserSettings;
}
