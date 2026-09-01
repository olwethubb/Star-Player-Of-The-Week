import { Suspense } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { MyAccountPanel } from '@/features/account/MyAccountPanel';
import { LazyManageTeamPanel } from '@/features/team-admin/ManageTeamPanel.lazy';
import { useSession } from '@/hooks/useSession';
import { WinnerBlock } from './WinnerBlock';
import { Scoreboard } from './Scoreboard';

export function ResultsPage() {
  const { me, profiles, settings, tally, isHost, loadedTally } = useSession();

  if (!me) return null;

  const total = settings.totalVotes || 0;

  return (
    <>
      <TopBar me={me} />
      <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted">Results</p>
      <h1 className="m-0 mb-5 font-serif text-[clamp(24px,6vw,34px)] font-bold italic leading-[1.15]">
        {total} vote{total === 1 ? '' : 's'} cast this week
      </h1>

      <WinnerBlock settings={settings} profiles={profiles} />

      {/* The per-person breakdown is the host's commentary sheet — who's leading, by
          how much, whether it's a tie. It's counts only; nothing here or anywhere
          else can say who cast them. */}
      {isHost && loadedTally && <Scoreboard profiles={profiles} tally={tally} total={total} />}

      {isHost && (
        <p className="mb-5 text-xs text-text-muted">Voting reopens automatically on Friday, when the new week starts.</p>
      )}
      <MyAccountPanel />
      <Suspense fallback={null}>{isHost && <LazyManageTeamPanel />}</Suspense>
    </>
  );
}
