import { describe, expect, it } from 'vitest';
import { computeWinners } from './winners';

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
