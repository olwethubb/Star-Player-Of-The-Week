import { getWeekKey } from './week';

/** How many consecutive recent weeks someone received at least one vote, counting
 * back from the last COMPLETED week (not the in-progress current one, so a streak
 * doesn't visibly drop to 0 every week before that week's even been revealed).
 * Walks real calendar dates through the existing (tested) week-key math instead of
 * parsing/ordering weekKey strings itself — "2026-W2" vs "2026-W12" don't sort
 * correctly as strings, and this sidesteps that entirely. */
export function computeStreak(receivedWeekKeys: ReadonlySet<string>, now: Date = new Date()): number {
  let streak = 0;
  const cursor = new Date(now);
  cursor.setDate(cursor.getDate() - 7);
  while (receivedWeekKeys.has(getWeekKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}
