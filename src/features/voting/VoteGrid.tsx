import { IconCheck, IconLock, IconUsers } from '@/components/ui/Icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { Avatar } from '@/components/ui/Avatar';
import { useStreaks } from '@/hooks/useStreaks';
import type { Profile } from '@/types/firestore';

interface VoteGridProps {
  votingOpen: boolean;
  weekPaused: boolean;
  others: [string, Profile][];
  myVote: string | null;
  pendingUid: string | null;
  onVote: (uid: string) => void;
}

export function VoteGrid({ votingOpen, weekPaused, others, myVote, pendingUid, onVote }: VoteGridProps) {
  const streaks = useStreaks();

  if (weekPaused) {
    return <EmptyState icon={<IconLock />}>No vote this week — see you next Friday!</EmptyState>;
  }
  if (!votingOpen) {
    return <EmptyState icon={<IconLock />}>Voting hasn't opened yet this week. Check back once an admin opens it.</EmptyState>;
  }
  if (others.length === 0) {
    return <EmptyState icon={<IconUsers />}>Add more teammates below before voting can start.</EmptyState>;
  }

  return (
    <>
      <div className="mb-6 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
        {others.map(([uid, p]) => {
          const voted = myVote === uid;
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
          {myVote ? 'Your vote is locked in.' : "You haven't voted yet."} Only admins can reveal the results, and
          only once they choose to.
        </span>
      </div>
    </>
  );
}
