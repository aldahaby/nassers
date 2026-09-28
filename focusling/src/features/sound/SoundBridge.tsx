import { useEffect, useRef } from 'react';
import { playSound, soundService } from '@/services/audio';
import { useGameStore } from '@/state';
import { focusCue, type FocusSnapshot } from './focusCue';

/**
 * Connects the saved Sound Effects / Haptics settings and the focus state to
 * the sound service, and plays the two focus cues from state changes (so they
 * fire exactly once, wherever the session was started or finished):
 * - Focus Start: once, when a session begins;
 * - Focus Complete: once, when a finished session's summary appears.
 * Stopping early plays nothing (no "failure" sound, ever).
 */
export function SoundBridge() {
  const enabled = useGameStore((s) => s.save?.profile.settings.soundEnabled ?? true);
  const haptics = useGameStore((s) => s.save?.profile.settings.hapticsEnabled ?? true);
  const activeId = useGameStore((s) => s.save?.focus.active?.id ?? null);
  const summary = useGameStore((s) => s.lastSummary);
  const debug = useGameStore((s) => s.save?.profile.settings.debugToolsEnabled ?? false);
  const prev = useRef<FocusSnapshot>({ activeId, summary });

  useEffect(() => {
    void soundService.start();
  }, []);

  useEffect(() => {
    soundService.update({ enabled, hapticsEnabled: haptics });
  }, [enabled, haptics]);

  // Developer tools only: expose the sound decisions log for QA scripts and the Audio Lab.
  useEffect(() => {
    const g = globalThis as { __focuslingSound?: unknown };
    if (debug) g.__focuslingSound = soundService;
    else delete g.__focuslingSound;
  }, [debug]);

  useEffect(() => {
    const cue = focusCue(prev.current, { activeId, summary });
    prev.current = { activeId, summary };
    if (cue) playSound(cue);
    // Focus state is updated after the cue, so the start cue itself is allowed.
    soundService.update({ focusActive: activeId !== null });
  }, [activeId, summary]);

  return null;
}
