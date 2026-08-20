import { Suspense } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { CashoutCard } from '@/features/wallet/CashoutCard';
import { LazyPastWinnersPanel, LazyPayoutQueuePanel } from '@/features/payouts/PayoutQueuePanel.lazy';
import { LazyManageTeamPanel } from '@/features/team-admin/ManageTeamPanel.lazy';
import { useCastVote } from '@/hooks/useVotingActions';
import { BONUS_AMOUNT } from '@/lib/constants';
import { VoteGrid } from './VoteGrid';
import { SessionControls } from './SessionControls';
import { VotingProgress } from './VotingProgress';
import { useSession } from '@/hooks/useSession';

export function MainScreen() {
  const {
    user,
    me,
    profiles,
    settings,
    myVote,
    myBalance,
    balances,
    tally,
    loadedTally,
    payoutQueue,
    payoutHistory,
    myPayout,
    isAdmin,
    canManagePayouts,
  } = useSession();

  const votingOpen = !!settings.votingOpen;
  const financeName = settings.financeUid ? profiles[settings.financeUid]?.name ?? null : null;
  const { castVote, pendingUid } = useCastVote(user?.uid ?? '', votingOpen);

  if (!user || !me) return null;

  const others = Object.entries(profiles).filter(([uid]) => uid !== user.uid);

  return (
    <>
      <TopBar me={me} balance={myBalance} />
      <h1 className="m-0 mb-2 font-serif text-[clamp(24px,6vw,34px)] font-bold italic leading-[1.15]">
        Star Player of the Week
      </h1>
      <p className="mb-7 max-w-[520px] text-sm leading-relaxed text-text-muted">
        Vote for the teammate who went above and beyond this week. The winner receives B${BONUS_AMOUNT}. Results
        stay hidden until an admin reveals them.
      </p>

      <CashoutCard uid={user.uid} profile={me} balance={myBalance} myPayout={myPayout} financeName={financeName} />

      {isAdmin && votingOpen && (
        <VotingProgress tally={tally} loadedTally={loadedTally} teammateCount={Object.keys(profiles).length} />
      )}

      <VoteGrid
        votingOpen={votingOpen}
        isAdmin={isAdmin}
        others={others}
        myVote={myVote}
        pendingUid={pendingUid}
        onVote={castVote}
      />

      {isAdmin && <SessionControls votingOpen={votingOpen} profiles={profiles} />}
      <Suspense fallback={null}>
        {canManagePayouts && <LazyPayoutQueuePanel queue={payoutQueue} resolvedBy={user.uid} />}
        {canManagePayouts && <LazyPastWinnersPanel history={payoutHistory} />}
        {isAdmin && <LazyManageTeamPanel profiles={profiles} balances={balances} financeUid={settings.financeUid} />}
      </Suspense>
    </>
  );
}
