import { getLevel, getProgression, totalXpForLevel, diffProgression } from '../progression/progressionService';

describe('progression', () => {
  it('follows the level curve', () => {
    expect(totalXpForLevel(1)).toBe(0);
    expect(totalXpForLevel(2)).toBe(50);
    expect(totalXpForLevel(3)).toBe(125);
    expect(totalXpForLevel(10)).toBe(1350);
    expect(getLevel(0)).toBe(1);
    expect(getLevel(49)).toBe(1);
    expect(getLevel(50)).toBe(2);
    expect(getLevel(1350)).toBe(10);
  });

  it('derives growth stage from lifetime XP', () => {
    expect(getProgression(0).stage).toBe('baby');
    expect(getProgression(299).stage).toBe('baby');
    expect(getProgression(300).stage).toBe('young');
    expect(getProgression(1500).stage).toBe('adult');
    expect(getProgression(5000).stage).toBe('evolved');
    expect(getProgression(5000).nextStageAtXp).toBeNull();
    expect(getProgression(150).stageProgress).toBeCloseTo(0.5);
  });

  it('reports XP within the current level', () => {
    const p = getProgression(60);
    expect(p.level).toBe(2);
    expect(p.xpIntoLevel).toBe(10);
    expect(p.xpForNextLevel).toBe(75);
  });

  it('detects level-ups and stage changes', () => {
    expect(diffProgression(40, 60)).toEqual({ leveledUpTo: 2, stageReached: null });
    expect(diffProgression(290, 310).stageReached).toBe('young');
    expect(diffProgression(10, 20)).toEqual({ leveledUpTo: null, stageReached: null });
  });
});
