import { describe, expect, it } from 'vitest';
import type { Timestamp } from 'firebase/firestore';
import type { Claim, Profile, StatDeclaration } from '@/types/firestore';
import { countableTally, findStaleClaimUids, roundParticipantCount } from './roundRules';

const WEEK = '2026-W40';
const MIN = 60_000;
const ts = (ms: number) => ({ toMillis: () => ms }) as unknown as Timestamp;
const up: StatDeclaration = { weekKey: WEEK, status: 'up' };
const down: StatDeclaration = { weekKey: WEEK, status: 'down' };
const profiles: Record<string, Profile> = {
  kg: { name: 'KG' },
  amilio: { name: 'Amilio' },
  pinto: { name: 'Pinto' },
  benita: { name: 'Benita' },
};

describe('countableTally', () => {
  it('keeps votes received by someone who went Home (no stats choice left)', () => {
    const result = countableTally({ amilio: 3, pinto: 1 }, profiles, { pinto: up }, WEEK);
    expect(result.amilio).toBe(3);
  });

  it('drops votes received by someone who switched to Stats Down', () => {
    const result = countableTally({ amilio: 3, pinto: 1 }, profiles, { amilio: down, pinto: up }, WEEK);
    expect(result).toMatchObject({ amilio: 0, pinto: 1 });
  });

  it('ignores a Down choice from a previous week', () => {
    const stale: StatDeclaration = { weekKey: '2026-W39', status: 'down' };
    expect(countableTally({ amilio: 2 }, profiles, { amilio: stale }, WEEK).amilio).toBe(2);
  });

  it('never counts votes for KG, or for someone no longer on the roster', () => {
    const result = countableTally({ kg: 5, removed: 9, pinto: 1 }, profiles, {}, WEEK);
    expect(result.kg).toBe(0);
    expect(result).not.toHaveProperty('removed');
  });
});

describe('findStaleClaimUids', () => {
  const now = 1_000 * MIN;

  it('sweeps a claim nobody has refreshed in 15 minutes', () => {
    const claims: Record<string, Claim> = {
      pinto: { claimedAt: ts(now - 60 * MIN), lastSeenAt: ts(now - 20 * MIN) },
      benita: { claimedAt: ts(now - 5 * MIN), lastSeenAt: ts(now) },
    };
    expect(findStaleClaimUids(claims, {}, WEEK, 15 * MIN, now)).toEqual(['pinto']);
  });

  it("never sweeps someone who's Up this week, however long their phone's been locked", () => {
    const claims: Record<string, Claim> = {
      amilio: { claimedAt: ts(now - 60 * MIN), lastSeenAt: ts(now - 40 * MIN) },
      benita: { claimedAt: ts(now), lastSeenAt: ts(now) },
    };
    expect(findStaleClaimUids(claims, { amilio: up }, WEEK, 15 * MIN, now)).toEqual([]);
  });

  it("treats a heartbeat that's still being written as fresh, not as its old claimedAt", () => {
    const claims: Record<string, Claim> = {
      me: { claimedAt: ts(now - 60 * MIN), lastSeenAt: null },
      benita: { claimedAt: ts(now), lastSeenAt: ts(now) },
    };
    expect(findStaleClaimUids(claims, {}, WEEK, 15 * MIN, now)).toEqual([]);
  });

  it("can't be tricked by a device whose clock is an hour fast", () => {
    const claims: Record<string, Claim> = {
      pinto: { claimedAt: ts(now - 2 * MIN), lastSeenAt: ts(now - 30_000) },
      benita: { claimedAt: ts(now - 1 * MIN), lastSeenAt: ts(now) },
    };
    expect(findStaleClaimUids(claims, {}, WEEK, 15 * MIN, now + 60 * MIN)).toEqual([]);
  });

  it('falls back to claimedAt for a claim from before heartbeats existed', () => {
    const claims: Record<string, Claim> = {
      old: { claimedAt: ts(now - 24 * 60 * MIN) },
      benita: { claimedAt: ts(now), lastSeenAt: ts(now) },
    };
    expect(findStaleClaimUids(claims, {}, WEEK, 15 * MIN, now)).toEqual(['old']);
  });
});

describe('roundParticipantCount', () => {
  it('counts a voter whose sign-in has since expired, without double-counting', () => {
    const claims: Record<string, Claim> = { kg: { claimedAt: null }, benita: { claimedAt: null } };
    expect(roundParticipantCount(claims, ['kg', 'amilio', 'pinto'])).toBe(4);
  });
});
