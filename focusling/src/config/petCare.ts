/**
 * Care-stat tuning. Stats are 0–100.
 *
 * Design rule: neglect makes the pet sleepy or bored, never sick or damaged.
 * Passive decay stops at the floors below, so coming back after a week
 * finds a drowsy pet that perks up after one session, not a punished one.
 */
export const PET_CARE = {
  statMin: 0,
  statMax: 100,

  newPetStats: {
    health: 80,
    happiness: 70,
  },

  /** Gains for a completed session, scaled by minutes and capped. */
  completion: {
    happinessPerMinute: 0.35,
    maxHappiness: 20,
    healthPerMinute: 0.15,
    maxHealth: 10,
  },

  /** A small, temporary mood dip for abandoning. Never touches health. */
  abandon: {
    happinessDelta: -3,
  },

  /** Passive drift while the app is closed. */
  decay: {
    happinessPerHour: 1,
    healthPerHour: 0.5,
    happinessFloor: 35,
    healthFloor: 50,
  },

  /** Tapping the pet. */
  petting: {
    happinessDelta: 1,
    cooldownMinutes: 5,
  },

  /** Mood thresholds on happiness (checked top to bottom). */
  moodThresholds: {
    joyful: 75,
    content: 50,
    sleepy: 30,
  },
} as const;
