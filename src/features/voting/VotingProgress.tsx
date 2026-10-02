import type { Voter } from '@/types/firestore';

/** Shown to everyone while voting is open — how many people have voted so far. Purely
 * informational: it doesn't trigger anything on its own — a revealer (KG, Steph, or
 * OB) still has to check around the office and click Reveal Winner explicitly,
 * whether turnout is full or not.
 *
 * This counts voter markers, which record only THAT someone voted. There is nothing
 * to break down by candidate here even in principle: the per-candidate counts live
 * in a separate collection the rules won't open until voting closes, and who-voted-
 * for-whom is never stored at all.
 *
 * `eligibleCount` is just every claimed name — a revealer votes too now, so there's
 * nobody left to subtract out. See the callers in MainScreen.tsx and
 * ResultsPage.tsx. */
export function VotingProgress({
  voters,
  weekKey,
  eligibleCount,
}: {
  voters: Record<string, Voter>;
  weekKey: string | null;
  eligibleCount: number;
}) {
  const votesCast = Object.values(voters).filter((v) => v.weekKey === weekKey).length;
  const total = Math.max(eligibleCount, votesCast);

  return (
    <div className="mb-5 flex items-center gap-2 rounded-xl border border-border-soft bg-bg-elevated px-4 py-3 text-[13px] text-text-muted">
      <span className="font-mono text-sm font-bold text-accent-ink">{votesCast}</span>
      <span>
        of {total} {total === 1 ? 'person has' : 'people have'} voted so far.
      </span>
    </div>
  );
}
