export interface IsoWeek {
  week: number;
  year: number;
}

/** ISO 8601 week number for `now` (or an injected date, for tests). */
export function isoWeek(now: Date = new Date()): IsoWeek {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7,
    );
  return { week, year: d.getUTCFullYear() };
}

/** A stable key for "which calendar week is it right now" — drives the weekly rollover. */
export function getWeekKey(now: Date = new Date()): string {
  const { week, year } = isoWeek(now);
  return `${year}-W${week}`;
}

export function getWeekLabel(now: Date = new Date()): string {
  const { week, year } = isoWeek(now);
  return `WEEK ${week} · ${year}`;
}
