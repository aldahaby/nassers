import type { DetectionPolicyConfig } from '@/config/protection';
import type { ContentSurface, SurfaceClassification, Timestamp } from '../models';

/**
 * Rolling-window vote over detector samples. Pure and deterministic: the native
 * Swift implementation follows exactly the same rules (see protectionVectors.json).
 */
export interface DetectionState {
  /** Most recent samples, oldest first: timestamp of each positive, or null for a negative. */
  samples: (Timestamp | null)[];
  cooldownUntil: Timestamp;
}

export type DetectionDecision = { intervene: false; votes: number } | { intervene: true; votes: number; surface: ContentSurface };

export function createDetectionState(): DetectionState {
  return { samples: [], cooldownUntil: 0 };
}

export function isPositive(c: SurfaceClassification, target: ContentSurface, policy: DetectionPolicyConfig): boolean {
  return c.surface === target && c.confidence >= policy.confidenceThreshold;
}

/**
 * Feed one sample. Returns the new state and whether to intervene now.
 * Intervention requires `requiredVotes` positives within the last `windowSize`
 * samples, spanning at least `minimumDetectionMs`, and not during cooldown.
 * Intervening starts the cooldown and clears the window.
 */
export function recordSample(
  state: DetectionState,
  classification: SurfaceClassification,
  at: Timestamp,
  target: ContentSurface,
  policy: DetectionPolicyConfig,
): { state: DetectionState; decision: DetectionDecision } {
  if (at < state.cooldownUntil) {
    return { state: { ...state, samples: [] }, decision: { intervene: false, votes: 0 } };
  }
  const samples = [...state.samples, isPositive(classification, target, policy) ? at : null].slice(-policy.windowSize);
  const positives = samples.filter((s): s is number => s !== null);
  const votes = positives.length;
  const span = votes > 0 ? positives[positives.length - 1]! - positives[0]! : 0;

  if (votes >= policy.requiredVotes && span >= policy.minimumDetectionMs) {
    return {
      state: { samples: [], cooldownUntil: at + policy.cooldownMs },
      decision: { intervene: true, votes, surface: target },
    };
  }
  return { state: { ...state, samples }, decision: { intervene: false, votes } };
}
