import { IconCheck, IconLock, IconUsers } from '@/components/ui/Icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { Avatar } from '@/components/ui/Avatar';
import { useStreaks } from '@/hooks/useStreaks';
import type { Profile } from '@/types/firestore';

interface VoteGridProps {
  votingOpen: boolean;
  others: [string, Profile][];
  /** Everyone on the roster except me — including people who haven't marked stats
   * up yet, unlike `others`. What separates the two empty states below: a genuinely
   * empty roster needs more people added, a populated one just needs them to open
   * the app and declare their status for the week. */
  teammateCount: number;
  /** Read from this browser's own storage, not the server — nothing server-side
   * records who you picked. See lib/localPick.ts. */
  myPick: string | null;
  pendingUid: string | null;
  onVote: (uid: string) => void;
}

export function VoteGrid({ votingOpen, others, teammateCount, myPick, pendingUid, onVote }: VoteGridProps) {
  const streaks = useStreaks();

  if (!votingOpen) {
    return <EmptyState icon={<IconLock />}>Voting hasn't opened yet this week. Check back once KG opens it.</EmptyState>;
  }
  if (others.length === 0) {
    return (
      <EmptyState icon={<IconUsers />}>
        {teammateCount === 0
          ? 'Add more teammates below before voting can start.'
          : "Nobody's marked their stats up for this week yet — this updates live, so the list fills in the moment someone does."}
      </EmptyState>
    );
  }

  return (
    <>
      <div className="mb-6 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
        {others.map(([uid, p]) => {
          const voted = myPick === uid;
          const streak = streaks[uid];
          return (
            <div
              key={uid}
              className={`flex items-center gap-3 rounded-2xl border bg-bg-card shadow-card transition-[transform,border-color] ${
                voted ? 'border-2 border-accent p-[15px]' : 'border border-border p-4 hover:-translate-y-0.5 hover:border-accent'
              }`}
            >
              <Avatar name={p.name} avatarUrl={p.avatarUrl} />
              <div className="min-w-0 flex-1 font-display text-[15px] font-semibold [overflow-wrap:anywhere]">
                {p.name}
                {!!streak && streak >= 3 && (
                  <span className="ml-1.5 whitespace-nowrap font-mono text-[11px] font-normal text-accent" title={`Received votes ${streak} weeks running`}>
                    🔥{streak}
                  </span>
                )}
              </div>
              <button
                disabled={pendingUid === uid}
                onClick={() => onVote(uid)}
                className={`inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2.5 text-[13px] font-semibold transition-transform active:scale-95 disabled:opacity-60 ${
                  voted ? 'border-accent bg-accent text-accent-contrast' : 'border-border bg-transparent text-text'
                }`}
              >
                {voted && <IconCheck />}
                {voted ? 'Voted' : 'Vote'}
              </button>
            </div>
          );
        })}
      </div>
      <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-border-soft bg-bg-elevated px-4 py-3 text-[13px] leading-relaxed text-text-muted">
        <IconLock className="mt-0.5 text-text-muted" />
        <span>
          {myPick ? 'Your vote is in — tap another name to change it.' : "You haven't voted yet."} Who you picked is
          never sent anywhere: KG sees the totals once voting closes, never the names behind them.
        </span>
      </div>
    </>
  );
}
