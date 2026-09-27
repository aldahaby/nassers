import type { Timestamp } from './common';

/** Who the app is for on this device. */
export type AppMode = 'self' | 'family';

/**
 * Local-only parent gate. The PIN is never stored: only a salted, iterated
 * SHA-256 digest. Throttling state is persisted so a reload doesn't reset it.
 * This is a convenience gate for a shared device, not OS-level security.
 */
export interface ParentGate {
  salt: string;
  hash: string;
  iterations: number;
  failedAttempts: number;
  lockedUntil: Timestamp;
}

/** Minimal child profile: a nickname only. No name, birthday, school or location. */
export interface ChildProfile {
  nickname: string;
}

export type PlayAccess = 'always' | 'afterMission';

export interface PlaySettings {
  access: PlayAccess;
}

export interface FamilySettings {
  /** Null until the parent creates a PIN during setup. */
  gate: ParentGate | null;
  child: ChildProfile;
  play: PlaySettings;
  setupCompletedAt: Timestamp | null;
}
