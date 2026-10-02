/** Pure winner-computation: given a uid->vote-count tally, returns every uid tied for
 * the most votes (empty array if nobody voted) — however many that is. A tie is never
 * resolved down to one; see joinNames below for how every name in it gets shown or
 * spoken together. Extracted from doReveal for unit testing. */
export function computeWinners(tally: Record<string, number>): { winnerUids: string[]; totalVotes: number } {
  const entries = Object.entries(tally);
  const totalVotes = entries.reduce((sum, [, count]) => sum + count, 0);
  if (totalVotes === 0) return { winnerUids: [], totalVotes: 0 };
  const top = Math.max(...entries.map(([, count]) => count));
  const winnerUids = entries.filter(([, count]) => count === top).map(([uid]) => uid);
  return { winnerUids, totalVotes };
}

/** Joins names the way a person would actually say them: one name alone, "A and B"
 * for two, or "A, B and C" for three or more — never a flat "&"-chain that gets
 * harder to parse as a tie grows past two names. Used everywhere a tie's names are
 * shown or spoken — the wheel's popup, the results page, and the TTS announcement —
 * so a 2-way and a 6-way tie read equally naturally. */
export function joinNames(names: string[], conjunction: string): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} ${conjunction} ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} ${conjunction} ${names[names.length - 1]}`;
}
