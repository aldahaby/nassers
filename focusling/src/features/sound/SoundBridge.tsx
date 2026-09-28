import { useEffect, useRef } from 'react';
import { playSound, soundService } from '@/services/audio';
import { useGameStore } from '@/state';

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
  const prevActive = useRef<string | null>(activeId);
  const prevSummary = useRef(summary);

  useEffect(() => {
    void soundService.start();
  }, []);

  useEffect(() => {
    soundService.update({ enabled, hapticsEnabled: haptics });
  }, [enabled, haptics]);

  useEffect(() => {
    const started = activeId !== null && prevActive.current === null;
    prevActive.current = activeId;
    if (started) playSound('focus-start');
    // Focus state is updated after the cue, so the start cue itself is allowed.
    soundService.update({ focusActive: activeId !== null });
  }, [activeId]);

  useEffect(() => {
    if (summary && summary !== prevSummary.current && summary.outcome === 'completed') playSound('focus-complete');
    prevSummary.current = summary;
  }, [summary]);

  return null;
}
