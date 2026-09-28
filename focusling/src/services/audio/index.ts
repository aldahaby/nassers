import type { SoundId } from '@/config/sounds';
import { ExpoHapticBackend, ExpoSoundBackend } from './ExpoSoundBackend';
import { SilentSoundBackend, SoundService } from './SoundService';

/**
 * The app-wide sound service. Tests get a silent backend; everything else uses
 * expo-audio (iOS, Android, web).
 */
const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
export const soundService = isTest ? new SoundService(new SilentSoundBackend()) : new SoundService(new ExpoSoundBackend(), new ExpoHapticBackend());

/** Request a semantic Focusling sound. Safe to call anywhere; it decides whether to play. */
export function playSound(id: SoundId): boolean {
  return soundService.play(id);
}

export { SilentSoundBackend, SoundService } from './SoundService';
export type { HapticBackend, SoundBackend, SoundState } from './SoundService';
export { SoundGate } from './soundPolicy';
