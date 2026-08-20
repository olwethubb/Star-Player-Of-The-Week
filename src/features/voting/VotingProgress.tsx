/** Admin-only, shown while voting is open — a live count of how many votes have
 * been cast so far, so an admin can judge when it's worth ending voting instead of
 * flying blind. Deliberately never breaks the count down by candidate; that stays
 * hidden (Scoreboard) until results are revealed. */
export function VotingProgress({
  tally,
  loadedTally,
  teammateCount,
}: {
  tally: Record<string, number>;
  loadedTally: boolean;
  teammateCount: number;
}) {
  if (!loadedTally) return null;
  const votesCast = Object.values(tally).reduce((sum, n) => sum + n, 0);

  return (
    <div className="mb-5 flex items-center gap-2 rounded-xl border border-border-soft bg-bg-elevated px-4 py-3 text-[13px] text-text-muted">
      <span className="font-mono text-sm font-bold text-accent">{votesCast}</span>
      <span>of {teammateCount} teammates have voted so far.</span>
    </div>
  );
}
