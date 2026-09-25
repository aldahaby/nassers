import type { ContentSurface, ProtectionSettings } from '@/core/models';

/**
 * Temporal confirmation for the on-device surface detector. A single suspicious
 * frame never triggers an intervention. The native detector uses the same values
 * (passed at session start) and is checked against `protectionVectors.json`.
 */
export const DETECTION_POLICY = {
  /** Classifications below this confidence count as "no". */
  confidenceThreshold: 0.75,
  /** Positive votes needed inside the rolling window. */
  requiredVotes: 3,
  /** Number of most recent samples considered. */
  windowSize: 5,
  /** Positive votes must span at least this long (ms) before intervening. */
  minimumDetectionMs: 1500,
  /** After an intervention, ignore detections for this long (ms) to avoid shield loops. */
  cooldownMs: 20_000,
} as const;

export type DetectionPolicyConfig = { -readonly [K in keyof typeof DETECTION_POLICY]: number };

/** Capture/sampling settings for selective mode. */
export const CAPTURE_CONFIG = {
  /** Frames analysed per second (the rest are dropped immediately). */
  samplesPerSecond: 1,
  /** Longest side of the downscaled analysis image, in pixels. */
  analysisMaxDimension: 640,
  /** Safety net: a temporary intervention shield is cleared after this long (ms). */
  interventionShieldTimeoutMs: 60_000,
} as const;

/** Surfaces that can be turned on this milestone. */
export const SUPPORTED_SURFACES: readonly ContentSurface[] = ['instagramReels'];

export const DEFAULT_PROTECTION: ProtectionSettings = {
  mode: 'none',
  surfaces: ['instagramReels'],
  fallbackBehavior: 'askUser',
};

/** DeviceActivity schedules must be at least this long (Apple: 15 minutes). */
export const DEVICE_ACTIVITY_MIN_INTERVAL_MS = 15 * 60_000;
