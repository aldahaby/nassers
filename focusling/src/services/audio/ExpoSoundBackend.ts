import { Platform } from 'react-native';
import type { SoundId } from '@/config/sounds';
import { SOUND_ASSETS } from './soundAssets';
import type { HapticBackend, HapticKind, SoundBackend } from './SoundService';

type Player = {
  volume: number;
  play(): void;
  pause(): void;
  seekTo(seconds: number): Promise<void>;
  remove(): void;
};
type ExpoAudio = {
  createAudioPlayer(source: number): Player;
  setAudioModeAsync(mode: Record<string, unknown>): Promise<void>;
};

/**
 * expo-audio playback (the SDK 57 audio module). One cached player per sound:
 * replaying a sound restarts that player, so rapid taps can never stack voices.
 *
 * Session etiquette: mix with other audio (music and podcasts keep playing),
 * respect the iOS silent switch (`playsInSilentMode: false`), never play in the
 * background, never record. The module is required lazily so a missing native
 * module (e.g. a stale dev client) just means silence.
 */
export class ExpoSoundBackend implements SoundBackend {
  private audio: ExpoAudio | null = null;
  private players = new Map<SoundId, Player>();

  async init() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.audio = require('expo-audio') as ExpoAudio;
    } catch {
      this.audio = null;
      return;
    }
    if (Platform.OS !== 'web') {
      await this.audio.setAudioModeAsync({
        playsInSilentMode: false,
        interruptionMode: 'mixWithOthers',
        shouldPlayInBackground: false,
        allowsRecording: false,
        shouldRouteThroughEarpiece: false,
      });
    }
  }

  preload(id: SoundId) {
    if (!this.audio || this.players.has(id)) return;
    try {
      this.players.set(id, this.audio.createAudioPlayer(SOUND_ASSETS[id]));
    } catch {
      // Leave it unloaded; play() will try again.
    }
  }

  play(id: SoundId, volume: number) {
    if (!this.audio) return;
    if (!this.players.has(id)) this.preload(id);
    const player = this.players.get(id);
    if (!player) return;
    player.volume = volume;
    // Restart from the top: the same sound never overlaps itself.
    void player.seekTo(0).catch(() => {});
    player.play();
  }

  dispose() {
    this.players.forEach((p) => {
      try {
        p.remove();
      } catch {
        // already released
      }
    });
    this.players.clear();
  }
}

type ExpoHaptics = {
  selectionAsync(): Promise<void>;
  impactAsync(style: unknown): Promise<void>;
  notificationAsync(type: unknown): Promise<void>;
  ImpactFeedbackStyle: { Light: unknown };
  NotificationFeedbackType: { Success: unknown };
};

/** expo-haptics, native only; always light. */
export class ExpoHapticBackend implements HapticBackend {
  private haptics: ExpoHaptics | null = null;
  constructor() {
    if (Platform.OS === 'web') return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.haptics = require('expo-haptics') as ExpoHaptics;
    } catch {
      this.haptics = null;
    }
  }
  fire(kind: HapticKind) {
    const h = this.haptics;
    if (!h) return;
    const p = kind === 'selection' ? h.selectionAsync() : kind === 'success' ? h.notificationAsync(h.NotificationFeedbackType.Success) : h.impactAsync(h.ImpactFeedbackStyle.Light);
    void p.catch(() => {});
  }
}
