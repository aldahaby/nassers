import type { PlannerState, Timestamp } from '../models';

/**
 * Sync boundary (future-ready, nothing remote today). Studyling is local-only:
 * the production provider is `LocalOnlySyncProvider`, which never sends data
 * anywhere. Possible future providers (each needs its own privacy review):
 *   - ApplePrivateSyncProvider (the student's own iCloud private database)
 *   - EncryptedStudylingSyncProvider (end-to-end encrypted; no server-readable content)
 * No accounts, servers or keys exist in this build.
 */
export interface SyncProvider {
  readonly id: 'localOnly' | 'applePrivate' | 'encryptedStudyling';
  /** True only for providers that move data off this device. */
  readonly remote: boolean;
  /** Offer the current document; a local-only provider keeps nothing extra. */
  push(state: PlannerState, at: Timestamp): Promise<{ pushed: false; reason: 'localOnly' } | { pushed: true }>;
  /** A newer document from elsewhere, if any. */
  pull(): Promise<PlannerState | null>;
}

export class LocalOnlySyncProvider implements SyncProvider {
  readonly id = 'localOnly' as const;
  readonly remote = false;
  async push(): Promise<{ pushed: false; reason: 'localOnly' }> {
    return { pushed: false, reason: 'localOnly' };
  }
  async pull(): Promise<null> {
    return null;
  }
}
