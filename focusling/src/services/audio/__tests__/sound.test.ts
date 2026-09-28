import fs from 'node:fs';
import path from 'node:path';
import { REACTIONS } from '@/config/reactions';
import { getSound, REACTION_SOUNDS, SOUND_RULES, SOUNDS, type SoundId } from '@/config/sounds';
import { focusCue } from '@/features/sound/focusCue';
import { inferSound } from '@/ui/components/Pressable';
import { SilentSoundBackend, SoundGate, SoundService, type HapticBackend } from '..';
import { SOUND_ASSETS } from '../soundAssets';

const ON = { enabled: true, focusActive: false };
const FOCUS = { enabled: true, focusActive: true };

describe('sound registry', () => {
  it('every semantic sound has a bundled asset, a mix level, a duration and provenance', () => {
    for (const s of SOUNDS) {
      expect([s.id, typeof SOUND_ASSETS[s.id]]).toEqual([s.id, 'number']);
      const file = path.join(__dirname, '../../../../assets/sfx', `${s.file}.wav`);
      expect([s.id, fs.existsSync(file)]).toEqual([s.id, true]);
      expect(fs.statSync(file).size).toBeLessThan(40_000); // tiny files
      expect(s.durationMs).toBeLessThanOrEqual(800); // short cues, no loops
      expect(s.volume).toBeGreaterThan(0);
      expect(s.volume).toBeLessThanOrEqual(0.5); // nothing loud
      expect(s.provenance).toMatch(/original/i);
      expect(['placeholder', 'final']).toContain(s.status);
    }
    expect(new Set(SOUNDS.map((s) => s.id)).size).toBe(SOUNDS.length);
  });

  it('every reaction has a short accent', () => {
    for (const r of REACTIONS) expect(getSound(REACTION_SOUNDS[r.style]).group).toBe('reaction');
  });

  it('there is no music or ambience in the palette', () => {
    for (const s of SOUNDS) expect(s.id).not.toMatch(/(^|-)(music|ambience|ambient|loop|rain|forest|fireplace)(-|$)/);
  });
});

describe('sound gate', () => {
  it('plays nothing when Sound Effects is off', () => {
    const gate = new SoundGate();
    for (const s of SOUNDS) expect(gate.request(s.id, { enabled: false, focusActive: false }, 1000)).toBeNull();
  });

  it('rapid taps of the same sound never pile up', () => {
    const gate = new SoundGate();
    let played = 0;
    for (let t = 0; t < 1000; t += 10) if (gate.request('tap', ON, t) !== null) played += 1;
    // 100 taps in one second → at most one every retriggerMs.
    expect(played).toBeLessThanOrEqual(Math.ceil(1000 / SOUND_RULES.retriggerMs));
    expect(played).toBeGreaterThan(0);
  });

  it('caps bursts of different UI sounds, but never drops focus or reward cues', () => {
    const gate = new SoundGate();
    const results = (['tap', 'nav', 'select', 'back'] as SoundId[]).map((id) => gate.request(id, ON, 5));
    expect(results.filter((v) => v !== null)).toHaveLength(SOUND_RULES.burstMax);
    expect(gate.request('focus-complete', ON, 6)).not.toBeNull();
    expect(gate.request('unlock', ON, 7)).not.toBeNull();
  });

  it('pet taps get at most one cue per interval, however fast', () => {
    const gate = new SoundGate();
    let played = 0;
    for (let t = 0; t < 3000; t += 50) if (gate.request('pet-cloudling', ON, t) !== null) played += 1;
    expect(played).toBeLessThanOrEqual(Math.ceil(3000 / SOUND_RULES.petMinMs));
  });

  it('during focus: explicit presses are quieter, focus cues play, pets/reactions/rewards stay silent', () => {
    const gate = new SoundGate();
    const tapFocus = gate.request('tap', FOCUS, 0)!;
    expect(tapFocus).toBeCloseTo(getSound('tap').volume * SOUND_RULES.masterVolume * SOUND_RULES.focusVolume);
    expect(gate.request('focus-complete', FOCUS, 500)).not.toBeNull();
    for (const id of ['pet-cloudling', 'rx-hop', 'rx-firefly', 'unlock', 'equip', 'purchase'] as SoundId[]) expect([id, gate.request(id, FOCUS, 2000)]).toEqual([id, null]);
  });
});

describe('sound service', () => {
  const setup = () => {
    let now = 0;
    const backend = new SilentSoundBackend();
    const fired: string[] = [];
    const haptics: HapticBackend = { fire: (k) => fired.push(k) };
    const service = new SoundService(backend, haptics, () => (now += 200));
    return { backend, service, fired };
  };

  it('initialises and preloads the common UI sounds', async () => {
    const { backend, service } = setup();
    await service.start();
    for (const id of ['tap', 'primary', 'nav', 'back', 'select', 'confirm'] as SoundId[]) expect(backend.preloaded.has(id)).toBe(true);
  });

  it('maps semantic requests to playback, and stops immediately when turned off', () => {
    const { backend, service } = setup();
    expect(service.play('equip')).toBe(true);
    expect(backend.played.at(-1)?.id).toBe('equip');
    service.update({ enabled: false });
    expect(service.play('nav')).toBe(false);
    expect(backend.played).toHaveLength(1);
  });

  it('pairs light haptics only when Haptics is on, and not with in-focus presses', () => {
    const { service, fired } = setup();
    service.play('confirm');
    expect(fired).toEqual(['light']);
    service.update({ hapticsEnabled: false });
    service.play('equip');
    expect(fired).toHaveLength(1);
    service.update({ hapticsEnabled: true, focusActive: true });
    service.play('primary');
    expect(fired).toHaveLength(1);
    service.play('focus-complete');
    expect(fired).toEqual(['light', 'success']);
  });
});

describe('focus cues', () => {
  const summary = (outcome: 'completed' | 'abandoned') => ({ outcome }) as never;
  it('Focus Start once when a session begins; Focus Complete once for a completed summary; nothing for an early stop', () => {
    expect(focusCue({ activeId: null, summary: null }, { activeId: 's1', summary: null })).toBe('focus-start');
    expect(focusCue({ activeId: 's1', summary: null }, { activeId: 's1', summary: null })).toBeNull();
    const done = summary('completed');
    expect(focusCue({ activeId: 's1', summary: null }, { activeId: null, summary: done })).toBe('focus-complete');
    expect(focusCue({ activeId: null, summary: done }, { activeId: null, summary: done })).toBeNull();
    expect(focusCue({ activeId: 's1', summary: null }, { activeId: null, summary: summary('abandoned') })).toBeNull();
  });
});

describe('press sounds', () => {
  it('infers the semantic sound from the control', () => {
    expect(inferSound({ accessibilityRole: 'tab' })).toBe('nav');
    expect(inferSound({ accessibilityRole: 'switch', accessibilityState: { checked: false } })).toBe('toggle-on');
    expect(inferSound({ accessibilityRole: 'switch', accessibilityState: { checked: true } })).toBe('toggle-off');
    expect(inferSound({ accessibilityRole: 'radio' })).toBe('select');
    expect(inferSound({ accessibilityRole: 'button', accessibilityLabel: 'Back' })).toBe('back');
    expect(inferSound({ accessibilityRole: 'button', accessibilityLabel: 'Cancel' })).toBe('back');
    expect(inferSound({ accessibilityRole: 'button', accessibilityLabel: 'Wardrobe' })).toBe('tap');
  });
});

describe('Pressable sound behaviour', () => {
  // Render the forwardRef component function directly and fire its press handler.
  const { Pressable } = jest.requireActual('@/ui/components/Pressable');
  const { soundService } = jest.requireActual('@/services/audio');
  const press = (props: Record<string, unknown>) => {
    const element = Pressable.render(props, null);
    element.props.onPress?.({});
  };

  it('a successful press plays its sound; disabled or silent presses never do', () => {
    soundService.update({ enabled: true, focusActive: false });
    const before = soundService.log.length;
    let pressed = 0;
    press({ onPress: () => (pressed += 1), sound: 'select' });
    expect(soundService.log.at(-1)?.id).toBe('select');
    const afterOne = soundService.log.length;
    expect(afterOne).toBe(before + 1);
    press({ onPress: () => (pressed += 1), sound: null });
    press({ onPress: () => (pressed += 1), disabled: true, sound: 'primary' });
    expect(soundService.log.length).toBe(afterOne);
    expect(pressed).toBeGreaterThanOrEqual(2);
  });

  it('turning Sound Effects off silences every press immediately', () => {
    soundService.update({ enabled: false });
    const before = soundService.log.length;
    press({ onPress: () => {}, sound: 'confirm' });
    expect(soundService.log.length).toBe(before);
    soundService.update({ enabled: true });
  });
});
