import { SOUNDS, type SoundId } from '@/config/sounds';
import { SoundGate, type SoundContext } from './soundPolicy';

/**
 * Platform playback behind an interface (like the protection service), so the
 * app and its tests never depend on a specific audio library.
 */
export interface SoundBackend {
  /** Configure the platform audio session. Must not stop other apps' audio. */
  init(): Promise<void>;
  /** Create/cache a player for a sound (called ahead of time). */
  preload(id: SoundId): void;
  /** Start (or restart) a sound at a volume. One voice per sound: a retrigger restarts it, it never stacks. */
  play(id: SoundId, volume: number): void;
  /** Release all players. */
  dispose(): void;
}

export type HapticKind = 'selection' | 'light' | 'success';
export interface HapticBackend {
  fire(kind: HapticKind): void;
}

/** Subtle haptics paired with a few sounds (only if Haptics is on). */
const HAPTIC_FOR: Partial<Record<SoundId, HapticKind>> = {
  primary: 'light',
  'toggle-on': 'selection',
  'toggle-off': 'selection',
  select: 'selection',
  equip: 'light',
  confirm: 'light',
  purchase: 'light',
  unlock: 'success',
  'focus-complete': 'success',
};

/** Sounds preloaded immediately; the rest shortly after start-up. */
const EAGER: readonly SoundId[] = ['tap', 'primary', 'nav', 'back', 'select', 'toggle-on', 'toggle-off', 'confirm', 'unavailable'];

export interface SoundState extends SoundContext {
  hapticsEnabled: boolean;
}

/**
 * The one place that decides and plays Focusling UI sounds. Callers ask for a
 * semantic sound (`play('equip')`); the service applies the user's setting,
 * the focus-session rules and rapid-tap protection, then hands the rest to the
 * platform backend. Game logic never touches this.
 */
export class SoundService {
  private gate = new SoundGate();
  private state: SoundState = { enabled: true, focusActive: false, hapticsEnabled: true };
  private started = false;
  /** Every accepted request, newest last (bounded): used by the Audio Lab and tests. */
  readonly log: { id: SoundId; volume: number; at: number }[] = [];

  constructor(
    private backend: SoundBackend,
    private haptics: HapticBackend | null = null,
    private clock: () => number = () => Date.now(),
  ) {}

  /** Configure the session and preload. Safe to call more than once. */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    try {
      await this.backend.init();
      EAGER.forEach((id) => this.backend.preload(id));
      setTimeout(() => SOUNDS.forEach((s) => this.backend.preload(s.id)), 1500);
    } catch {
      // Audio is supplementary: if the platform refuses, the app carries on silently.
    }
  }

  update(patch: Partial<SoundState>) {
    this.state = { ...this.state, ...patch };
  }

  getState(): SoundState {
    return this.state;
  }

  /** Request a semantic sound. Returns true if it played. */
  play(id: SoundId): boolean {
    const volume = this.gate.request(id, this.state, this.clock());
    const haptic = HAPTIC_FOR[id];
    if (haptic && this.state.hapticsEnabled && this.haptics && (!this.state.focusActive || id === 'focus-complete')) this.haptics.fire(haptic);
    if (volume === null) return false;
    this.log.push({ id, volume, at: this.clock() });
    if (this.log.length > 50) this.log.shift();
    try {
      this.backend.play(id, volume);
    } catch {
      return false;
    }
    return true;
  }

  dispose() {
    this.backend.dispose();
    this.started = false;
    this.gate.reset();
  }
}

/** A backend that plays nothing (tests, platforms without audio). */
export class SilentSoundBackend implements SoundBackend {
  readonly played: { id: SoundId; volume: number }[] = [];
  readonly preloaded = new Set<SoundId>();
  async init() {}
  preload(id: SoundId) {
    this.preloaded.add(id);
  }
  play(id: SoundId, volume: number) {
    this.played.push({ id, volume });
  }
  dispose() {
    this.preloaded.clear();
  }
}
