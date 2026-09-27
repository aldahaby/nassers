import { PARENT_GATE } from '@/config/family';
import { sha256Hex } from '../shared/sha256';
import type { ParentGate, Timestamp } from '../models';

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PARENT_GATE.pinLength}}$`).test(pin);
}

/** Salted, iterated SHA-256. The PIN itself is never stored. */
export function hashPin(pin: string, salt: string, iterations: number): string {
  let digest = sha256Hex(`${salt}:${pin}`);
  for (let i = 1; i < iterations; i += 1) digest = sha256Hex(`${salt}:${digest}`);
  return digest;
}

export function createParentGate(pin: string, salt: string): ParentGate {
  if (!isValidPin(pin)) throw new Error('PIN must be 4 digits');
  const iterations = PARENT_GATE.hashIterations;
  return { salt, hash: hashPin(pin, salt, iterations), iterations, failedAttempts: 0, lockedUntil: 0 };
}

export type PinCheck =
  | { ok: true; gate: ParentGate }
  | { ok: false; reason: 'locked'; retryAt: Timestamp; gate: ParentGate }
  | { ok: false; reason: 'wrong'; attemptsBeforePause: number; gate: ParentGate };

/** Pause length after `failed` wrong attempts (0 while still within the free attempts). */
export function lockoutFor(failed: number): number {
  const over = failed - PARENT_GATE.freeAttempts;
  if (over < 0) return 0;
  return Math.min(PARENT_GATE.maxLockoutMs, PARENT_GATE.lockoutMs * 2 ** over);
}

/** Check a PIN, updating attempt counters. Locked gates reject without checking. */
export function verifyParentPin(gate: ParentGate, pin: string, now: Timestamp): PinCheck {
  if (now < gate.lockedUntil) return { ok: false, reason: 'locked', retryAt: gate.lockedUntil, gate };
  if (isValidPin(pin) && hashPin(pin, gate.salt, gate.iterations) === gate.hash) {
    return { ok: true, gate: { ...gate, failedAttempts: 0, lockedUntil: 0 } };
  }
  const failedAttempts = gate.failedAttempts + 1;
  const pause = lockoutFor(failedAttempts);
  const next = { ...gate, failedAttempts, lockedUntil: pause > 0 ? now + pause : 0 };
  if (pause > 0) return { ok: false, reason: 'locked', retryAt: next.lockedUntil, gate: next };
  return { ok: false, reason: 'wrong', attemptsBeforePause: PARENT_GATE.freeAttempts - failedAttempts, gate: next };
}
