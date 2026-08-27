import { describe, expect, it } from 'vitest';
import { computeStreak } from './streak';
import { getWeekKey } from './week';

function weeksAgo(n: number, from: Date): string {
  const d = new Date(from);
  d.setDate(d.getDate() - 7 * n);
  return getWeekKey(d);
}

describe('computeStreak', () => {
  it('counts consecutive weeks ending at last week, not the current in-progress one', () => {
    const now = new Date('2026-08-20T12:00:00Z'); // a Thursday
    const received = new Set([weeksAgo(1, now), weeksAgo(2, now), weeksAgo(3, now)]);
    expect(computeStreak(received, now)).toBe(3);
  });

  it('stops at the first gap', () => {
    const now = new Date('2026-08-20T12:00:00Z');
    const received = new Set([weeksAgo(1, now), weeksAgo(3, now)]); // week 2 missing
    expect(computeStreak(received, now)).toBe(1);
  });

  it('ignores the current (not-yet-completed) week entirely', () => {
    const now = new Date('2026-08-20T12:00:00Z');
    const received = new Set([getWeekKey(now)]); // only this week, no history
    expect(computeStreak(received, now)).toBe(0);
  });

  it('returns 0 with no history', () => {
    expect(computeStreak(new Set(), new Date('2026-08-20T12:00:00Z'))).toBe(0);
  });
});
