import { describe, expect, it } from 'vitest';
import { computeWinners, joinNames } from './winners';

describe('computeWinners', () => {
  it('returns no winner when nobody voted', () => {
    expect(computeWinners({ a: 0, b: 0 })).toEqual({ winnerUids: [], totalVotes: 0 });
  });

  it('picks the single highest-count uid', () => {
    expect(computeWinners({ a: 3, b: 5, c: 1 })).toEqual({ winnerUids: ['b'], totalVotes: 9 });
  });

  it('returns every uid tied for the top count', () => {
    const result = computeWinners({ a: 4, b: 4, c: 2 });
    expect(result.totalVotes).toBe(10);
    expect(result.winnerUids.sort()).toEqual(['a', 'b']);
  });

  it('treats an empty tally as zero votes', () => {
    expect(computeWinners({})).toEqual({ winnerUids: [], totalVotes: 0 });
  });
});

describe('joinNames', () => {
  it('returns a single name as-is', () => {
    expect(joinNames(['Amilio'], 'and')).toBe('Amilio');
  });

  it('joins two names with the conjunction, no comma', () => {
    expect(joinNames(['Amilio', 'Benita'], 'and')).toBe('Amilio and Benita');
  });

  it('comma-separates three or more, with the conjunction before the last', () => {
    expect(joinNames(['Amilio', 'Benita', 'Jerome'], 'and')).toBe('Amilio, Benita and Jerome');
    expect(joinNames(['Amilio', 'Benita', 'Jerome', 'Malaika'], '&')).toBe('Amilio, Benita, Jerome & Malaika');
  });

  it('returns an empty string for an empty list', () => {
    expect(joinNames([], 'and')).toBe('');
  });
});
