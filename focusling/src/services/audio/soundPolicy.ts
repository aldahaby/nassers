import { getSound, SOUND_RULES, type SoundId } from '@/config/sounds';

export interface SoundContext {
  /** The user's Sound Effects setting. */
  enabled: boolean;
  /** A focus session is running. */
  focusActive: boolean;
}

/**
 * Decides whether a requested sound plays, and how loud. Pure and clock-driven
 * (`now` passed in) so it is unit-tested: no playback when Sound Effects is off,
 * focus-session silence rules, and rapid-tap protection.
 */
export class SoundGate {
  private lastBySound = new Map<SoundId, number>();
  private recent: number[] = [];
  private lastPet = -Infinity;

  /** Returns the playback volume (0–1), or null if the sound must not play. */
  request(id: SoundId, ctx: SoundContext, now: number): number | null {
    if (!ctx.enabled) return null;
    const def = getSound(id);
    if (ctx.focusActive && !SOUND_RULES.focusAllowed.includes(id)) return null;
    const last = this.lastBySound.get(id) ?? -Infinity;
    if (now - last < (def.retriggerMs ?? SOUND_RULES.retriggerMs)) return null;
    if (def.group === 'pet' && now - this.lastPet < SOUND_RULES.petMinMs) return null;
    this.recent = this.recent.filter((t) => now - t < SOUND_RULES.burstWindowMs);
    // Focus and reward cues are never dropped by the burst cap; UI chatter is.
    if (this.recent.length >= SOUND_RULES.burstMax && (def.group === 'ui' || def.group === 'pet')) return null;
    this.recent.push(now);
    this.lastBySound.set(id, now);
    if (def.group === 'pet') this.lastPet = now;
    const focusScale = ctx.focusActive && def.group === 'ui' ? SOUND_RULES.focusVolume : 1;
    return Math.min(1, def.volume * SOUND_RULES.masterVolume * focusScale);
  }

  reset() {
    this.lastBySound.clear();
    this.recent = [];
    this.lastPet = -Infinity;
  }
}
