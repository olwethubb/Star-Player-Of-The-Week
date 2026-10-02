import { isHostProfile, type Claim, type Profile, type StatDeclaration } from '@/types/firestore';

function isStatus(decl: StatDeclaration | undefined, currentWeek: string | null, status: 'up' | 'down') {
  return !!decl && decl.weekKey === currentWeek && decl.status === status;
}

/** Which received votes actually count at the reveal. Everyone's count stands EXCEPT:
 * someone who switched to Stats Down this week (Down takes away the votes you'd
 * received), KG (the CEO is never up for the vote), and a count left behind for
 * someone removed from the roster. Deliberately keyed on an explicit Down rather than
 * "currently Up": going Home or having your sign-in expire clears or skips your
 * stats choice, and neither may cost you the votes other people already gave you. */
export function countableTally(
  rawTally: Record<string, number>,
  profiles: Record<string, Profile>,
  statuses: Record<string, StatDeclaration>,
  currentWeek: string | null,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const uid of Object.keys(profiles)) {
    const counts = !isHostProfile(profiles[uid]) && !isStatus(statuses[uid], currentWeek, 'down');
    out[uid] = counts ? rawTally[uid] ?? 0 : 0;
  }
  return out;
}

/** Claims nobody's heartbeat has refreshed in `staleAfterMs` — closed tabs, dead
 * phones. Three guards keep this from ever signing out someone who's really there:
 *
 *  - Someone Up this week is never swept. They're a candidate, and a locked phone
 *    mustn't drop them off the poll mid-session.
 *  - A claim whose heartbeat write is still in flight (lastSeenAt === null, the local
 *    placeholder Firestore shows for a pending serverTimestamp) is treated as fresh —
 *    not judged by its old claimedAt.
 *  - Staleness is measured against BOTH this device's clock and the newest heartbeat
 *    anyone has (a server timestamp), so one device with a fast clock can't decide
 *    every active session is old and keep signing everyone out. */
export function findStaleClaimUids(
  claims: Record<string, Claim>,
  statuses: Record<string, StatDeclaration>,
  currentWeek: string | null,
  staleAfterMs: number,
  nowMs: number,
): string[] {
  const seenAt = (c: Claim): number | undefined => {
    if (c.lastSeenAt === null) return undefined;
    return (c.lastSeenAt ?? c.claimedAt)?.toMillis();
  };
  const times = Object.values(claims)
    .map(seenAt)
    .filter((t): t is number => t !== undefined);
  if (times.length === 0) return [];
  const cutoff = Math.min(nowMs, Math.max(...times)) - staleAfterMs;

  return Object.entries(claims)
    .filter(([uid, c]) => {
      if (isStatus(statuses[uid], currentWeek, 'up')) return false;
      const t = seenAt(c);
      return t !== undefined && t < cutoff;
    })
    .map(([uid]) => uid);
}

/** How many people are taking part this round, for "N of M have voted": everyone
 * signed in right now, plus anyone who already voted and has since been signed out —
 * their vote still counts, so they're still part of the round. Counting signed-in
 * names alone would let M fall below the votes cast once voters' sign-ins expire,
 * and the counter would read "everyone's voted" while people still haven't. */
export function roundParticipantCount(
  claims: Record<string, Claim>,
  voterUidsThisWeek: string[],
): number {
  return new Set([...Object.keys(claims), ...voterUidsThisWeek]).size;
}
