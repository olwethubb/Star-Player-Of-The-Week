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
  it('formats as YYYY-Www', () => {
    expect(getWeekKey(new Date('2024-01-01T12:00:00Z'))).toBe('2024-W1');
  });
});
