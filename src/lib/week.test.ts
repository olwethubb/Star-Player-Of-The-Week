import { describe, expect, it } from 'vitest';
import { getWeekKey, isoWeek } from './week';

describe('isoWeek', () => {
  it('gets week 1 for a date in early January that belongs to the previous ISO year', () => {
    // Jan 1, 2023 was a Sunday — ISO week 52 of 2022, not week 1 of 2023.
    expect(isoWeek(new Date('2023-01-01T12:00:00Z'))).toEqual({ week: 52, year: 2022 });
  });

  it('gets week 1 for a date that is genuinely the first Thursday-containing week', () => {
    // Jan 2, 2023 was a Monday — the first day of ISO week 1, 2023.
    expect(isoWeek(new Date('2023-01-02T12:00:00Z'))).toEqual({ week: 1, year: 2023 });
  });

  it('handles the Dec/Jan boundary where the last days of December fall in week 1 of next year', () => {
    // Jan 1, 2024 was a Monday — the first day of ISO week 1, 2024.
    expect(isoWeek(new Date('2024-01-01T12:00:00Z'))).toEqual({ week: 1, year: 2024 });
    // Dec 31, 2023 was a Sunday, the last day of the same week 52, 2023.
    expect(isoWeek(new Date('2023-12-31T12:00:00Z'))).toEqual({ week: 52, year: 2023 });
  });

  it('handles a 53-week year', () => {
    // 2020 had 53 ISO weeks; Dec 31, 2020 was a Thursday in week 53.
    expect(isoWeek(new Date('2020-12-31T12:00:00Z'))).toEqual({ week: 53, year: 2020 });
  });
});

describe('getWeekKey', () => {
  it('formats as YYYY-Www, anchored to the Friday-Thursday voting week rather than the ISO calendar week', () => {
    // Jan 1, 2024 was a Monday — mid-way through the voting week that started
    // the preceding Friday (Dec 29, 2023), which sits in ISO week 52 of 2023.
    expect(getWeekKey(new Date('2024-01-01T12:00:00Z'))).toBe('2023-W52');
  });

  it('rolls over exactly at the Thursday-to-Friday boundary', () => {
    // Jan 5, 2023 was a Thursday — the last day of the voting week anchored
    // to ISO week 52, 2022. Jan 6, 2023 was the very next day, a Friday —
    // the first day of the next voting week, ISO week 1, 2023.
    expect(getWeekKey(new Date('2023-01-05T12:00:00Z'))).toBe('2022-W52');
    expect(getWeekKey(new Date('2023-01-06T12:00:00Z'))).toBe('2023-W1');
  });

  it('keeps the same key across an entire Friday-to-Thursday span', () => {
    // Friday Jan 6 through Thursday Jan 12, 2023 is one voting week.
    const days = ['2023-01-06', '2023-01-07', '2023-01-09', '2023-01-11', '2023-01-12'];
    for (const day of days) {
      expect(getWeekKey(new Date(`${day}T12:00:00Z`))).toBe('2023-W1');
    }
  });
});
