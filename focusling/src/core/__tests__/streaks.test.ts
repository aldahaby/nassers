import { createStreakState, getEffectiveStreakDays, recordSessionForStreak } from '../streaks/streakService';

describe('streaks', () => {
  it('counts consecutive days once per day', () => {
    let s = createStreakState();
    s = recordSessionForStreak(s, 'completed', '2026-01-01');
    s = recordSessionForStreak(s, 'completed', '2026-01-01');
    s = recordSessionForStreak(s, 'completed', '2026-01-02');
    expect(s.currentDays).toBe(2);
    expect(s.currentSessionStreak).toBe(3);
  });

  it('forgives a missed day with a freeze', () => {
    let s = createStreakState(); // starts with one freeze
    s = recordSessionForStreak(s, 'completed', '2026-01-01');
    expect(getEffectiveStreakDays(s, '2026-01-03')).toBe(1);
    s = recordSessionForStreak(s, 'completed', '2026-01-03');
    expect(s.currentDays).toBe(2);
    expect(s.freezesAvailable).toBe(0);
  });

  it('restarts after a long gap but keeps the best streak', () => {
    let s = createStreakState();
    s = recordSessionForStreak(s, 'completed', '2026-01-01');
    s = recordSessionForStreak(s, 'completed', '2026-01-02');
    expect(getEffectiveStreakDays(s, '2026-01-10')).toBe(0);
    s = recordSessionForStreak(s, 'completed', '2026-01-10');
    expect(s.currentDays).toBe(1);
    expect(s.bestDays).toBe(2);
  });

  it('abandoning only resets the session streak', () => {
    let s = createStreakState();
    s = recordSessionForStreak(s, 'completed', '2026-01-01');
    s = recordSessionForStreak(s, 'abandoned', '2026-01-01');
    expect(s.currentDays).toBe(1);
    expect(s.currentSessionStreak).toBe(0);
    expect(s.bestSessionStreak).toBe(1);
  });

  it('earns a freeze every 7 days', () => {
    let s = { ...createStreakState(), freezesAvailable: 0 };
    for (let d = 1; d <= 7; d += 1) s = recordSessionForStreak(s, 'completed', `2026-01-0${d}`);
    expect(s.currentDays).toBe(7);
    expect(s.freezesAvailable).toBe(1);
  });
});
