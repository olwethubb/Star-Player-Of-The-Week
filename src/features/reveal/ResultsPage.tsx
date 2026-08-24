import { Suspense } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { ChangePinPanel } from '@/features/account/ChangePinPanel';
import { LazyPastWinnersPanel, LazyPayoutQueuePanel } from '@/features/payouts/PayoutQueuePanel.lazy';
import { LazyManageTeamPanel } from '@/features/team-admin/ManageTeamPanel.lazy';
import { useSession } from '@/hooks/useSession';
import { WinnerBlock } from './WinnerBlock';
import { Scoreboard } from './Scoreboard';

export function ResultsPage() {
  const {
    user,
    me,
    profiles,
    settings,
    myBalance,
    tally,
    balances,
    payoutQueue,
    payoutHistory,
    isAdmin,
    canManagePayouts,
    loadedTally,
  } = useSession();

  if (!user || !me) return null;

  const total = settings.totalVotes || 0;

  return (
    <>
      <TopBar me={me} balance={myBalance} />
      <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted">Results</p>
      <h1 className="m-0 mb-5 font-serif text-[clamp(24px,6vw,34px)] font-bold italic leading-[1.15]">
        {total} vote{total === 1 ? '' : 's'} cast this week
      </h1>

      <WinnerBlock settings={settings} profiles={profiles} />

      {isAdmin && loadedTally && <Scoreboard profiles={profiles} tally={tally} total={total} />}

      {isAdmin && (
        <p className="mb-5 text-xs text-text-muted">Voting reopens automatically on Friday, when the new week starts.</p>
      )}
      <ChangePinPanel />
      <Suspense fallback={null}>
        {canManagePayouts && <LazyPayoutQueuePanel queue={payoutQueue} resolvedBy={user.uid} />}
        {canManagePayouts && <LazyPastWinnersPanel history={payoutHistory} />}
        {isAdmin && (
          <LazyManageTeamPanel
            profiles={profiles}
            balances={balances}
            financeUid={settings.financeUid}
            actingUid={user.uid}
          />
        )}
      </Suspense>
    </>
  );
}
