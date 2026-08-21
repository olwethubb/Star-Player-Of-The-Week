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

// The voting cycle is Friday through Thursday, not the ISO calendar week
// (Monday through Sunday) — Friday is 4 days after ISO's Monday start, so
// shifting the input back 4 days before running the (otherwise untouched)
// ISO week math maps every day of one Fri-Thu span onto the same Monday,
// giving all seven of those days the same key. The visible "WEEK N" label
// still uses the ISO week number, just anchored to this shifted boundary.
const BUSINESS_WEEK_OFFSET_DAYS = 4;

function toBusinessWeekAnchor(now: Date): Date {
  const shifted = new Date(now);
  shifted.setDate(shifted.getDate() - BUSINESS_WEEK_OFFSET_DAYS);
  return shifted;
}

/** A stable key for "which voting week is it right now" — drives the weekly
 * rollover. Changes at the Thursday-to-Friday boundary, so a new week's
 * voting can open first thing Friday rather than following the calendar
 * week. */
export function getWeekKey(now: Date = new Date()): string {
  const { week, year } = isoWeek(toBusinessWeekAnchor(now));
  return `${year}-W${week}`;
}

export function getWeekLabel(now: Date = new Date()): string {
  const { week, year } = isoWeek(toBusinessWeekAnchor(now));
  return `WEEK ${week} · ${year}`;
}
