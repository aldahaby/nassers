import { formatClockTime } from '../format';

const MINUTE = 60_000;
// Local-time constructor, so results don't depend on the test machine's time zone.
const at = (h: number, m: number) => new Date(2026, 8, 25, h, m).getTime();

describe('formatClockTime', () => {
  it('rolls a session over midnight: 11:50 PM + 45 min → 12:35 AM', () => {
    expect(formatClockTime(at(23, 50))).toBe('11:50 PM');
    expect(formatClockTime(at(23, 50) + 45 * MINUTE)).toBe('12:35 AM');
  });

  it('shows midnight as 12 AM, never 0', () => {
    expect(formatClockTime(at(0, 0))).toBe('12:00 AM');
    expect(formatClockTime(at(0, 34))).toBe('12:34 AM');
  });

  it('shows noon as 12 PM', () => {
    expect(formatClockTime(at(12, 0))).toBe('12:00 PM');
    expect(formatClockTime(at(12, 5))).toBe('12:05 PM');
  });

  it('formats morning and afternoon times', () => {
    expect(formatClockTime(at(9, 7))).toBe('9:07 AM');
    expect(formatClockTime(at(15, 45))).toBe('3:45 PM');
    expect(formatClockTime(at(11, 59))).toBe('11:59 AM');
  });
});
