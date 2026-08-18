/** Pure winner-computation: given a uid->vote-count tally, returns every uid tied for
 * the most votes (empty array if nobody voted). Extracted from doReveal for unit testing. */
export function computeWinners(tally: Record<string, number>): { winnerUids: string[]; totalVotes: number } {
  const entries = Object.entries(tally);
  const totalVotes = entries.reduce((sum, [, count]) => sum + count, 0);
  if (totalVotes === 0) return { winnerUids: [], totalVotes: 0 };
  const top = Math.max(...entries.map(([, count]) => count));
  const winnerUids = entries.filter(([, count]) => count === top).map(([uid]) => uid);
  return { winnerUids, totalVotes };
}
