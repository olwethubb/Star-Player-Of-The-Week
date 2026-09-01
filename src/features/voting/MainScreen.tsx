import { Suspense } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { LazyManageTeamPanel } from '@/features/team-admin/ManageTeamPanel.lazy';
import { useCastVote } from '@/hooks/useVotingActions';
import { VoteGrid } from './VoteGrid';
import { StatStatusGate } from './StatStatusGate';
import { SessionControls } from './SessionControls';
import { VotingProgress } from './VotingProgress';
import { useSession } from '@/hooks/useSession';

export function MainScreen() {
  const { myUid, me, profiles, claims, settings, voters, statStatuses, myPick, isHost, canManageTeam } = useSession();

  const votingOpen = !!settings.votingOpen;
  const { castVote, pendingUid } = useCastVote();

  if (!myUid || !me) return null;

  const runoffUids = settings.runoffUids;
  // Claimed AND up this week — a name nobody holds isn't a real candidate, even if
  // an 'up' declaration is still sitting there from before it was released. Matches
  // firestore.rules' isEligibleCandidate, which is what actually enforces this on
  // the tally itself; this is what keeps the UI in step with it.
  const isEligibleCandidate = (uid: string) => {
    const decl = statStatuses[uid];
    return !!claims[uid] && !!decl && decl.weekKey === settings.currentWeek && decl.status === 'up';
  };
  const others = Object.entries(profiles).filter(
    ([uid]) => uid !== myUid && isEligibleCandidate(uid) && (!runoffUids || runoffUids.includes(uid)),
  );
  const myDeclaredStatus = statStatuses[myUid]?.weekKey === settings.currentWeek ? statStatuses[myUid]!.status : null;
  // Voting is open and they haven't declared their status yet this week — the grid
  // stays hidden until they do, StatStatusGate above is all there is to see.
  const awaitingMyStatus = votingOpen && !myDeclaredStatus;

  return (
    <>
      <TopBar me={me} />
      <h1 className="m-0 mb-2 font-serif text-[clamp(24px,6vw,34px)] font-bold italic leading-[1.15]">
        Star Player of the Week
      </h1>
      <p className="mb-7 max-w-[520px] text-sm leading-relaxed text-text-muted">
        Vote for the teammate who went above and beyond this week.
      </p>

      {votingOpen && !isHost && <StatStatusGate uid={myUid} current={myDeclaredStatus} />}

      {isHost ? (
        <>
          <p className="mb-5 rounded-xl border border-border-soft bg-bg-elevated px-4 py-3 text-[13px] text-text-muted">
            You're running this week's session, so you don't cast a vote.
          </p>
          {votingOpen && (
            <VotingProgress voters={voters} weekKey={settings.currentWeek} eligibleCount={Object.keys(claims).length - 1} />
          )}
        </>
      ) : awaitingMyStatus ? null : (
        <>
          {runoffUids && (
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.1em] text-accent">
              Runoff — vote for one of the tied players
            </p>
          )}
          <VoteGrid
            votingOpen={votingOpen}
            others={others}
            teammateCount={Object.keys(profiles).length - 1}
            myPick={myPick}
            pendingUid={pendingUid}
            onVote={castVote}
          />
        </>
      )}

      {isHost && <SessionControls votingOpen={votingOpen} revealing={!!settings.revealing} />}
      <Suspense fallback={null}>{canManageTeam && <LazyManageTeamPanel />}</Suspense>
    </>
  );
}
