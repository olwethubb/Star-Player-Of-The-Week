import { Suspense } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { LazyManageTeamPanel } from '@/features/team-admin/ManageTeamPanel.lazy';
import { useCastVote } from '@/hooks/useVotingActions';
import { VoteGrid } from './VoteGrid';
import { StatStatusGate } from './StatStatusGate';
import { SessionControls } from './SessionControls';
import { VotingProgress } from './VotingProgress';
import { useSession } from '@/hooks/useSession';
import { isHostProfile } from '@/types/firestore';
import { roundParticipantCount } from '@/lib/roundRules';
import { IconEye } from '@/components/ui/Icons';

export function MainScreen() {
  const { myUid, me, profiles, claims, settings, voters, statStatuses, loadedStatStatuses, myPick, canReveal } =
    useSession();

  const votingOpen = !!settings.votingOpen;
  const { castVote, pendingUid } = useCastVote();

  if (!myUid || !me) return null;

  // Claimed AND up this week — a name nobody holds isn't a real candidate, even if
  // an 'up' declaration is still sitting there from before it was released. Matches
  // firestore.rules' isEligibleCandidate, which is what actually enforces this on
  // the tally itself; this is what keeps the UI in step with it. KG is excluded
  // outright regardless of any declaration — the CEO isn't up for the vote, full stop.
  const isEligibleCandidate = (uid: string) => {
    const decl = statStatuses[uid];
    return !!claims[uid] && !!decl && decl.weekKey === settings.currentWeek && decl.status === 'up';
  };
  const others = Object.entries(profiles).filter(
    ([uid, p]) => uid !== myUid && !isHostProfile(p) && isEligibleCandidate(uid),
  );
  const myDeclaredStatus = statStatuses[myUid]?.weekKey === settings.currentWeek ? statStatuses[myUid]!.status : null;
  const voterUidsThisWeek = Object.entries(voters)
    .filter(([, v]) => v.weekKey === settings.currentWeek)
    .map(([uid]) => uid);
  const votesCast = voterUidsThisWeek.length;
  // My pick switched to Stats Down after I voted for them — Down takes away their
  // received votes at the reveal (see countableTally), so mine no longer counts. Tell
  // me, and drop the "Voted" tick so I re-vote; voting again still takes my old -1 off
  // their count (useCastVote passes the real myPick). Only an explicit Down: if they
  // just went Home, the votes they'd received — mine included — still count.
  const pickDecl = myPick ? statStatuses[myPick] : undefined;
  const stalePick =
    votingOpen && loadedStatStatuses && myPick && pickDecl?.weekKey === settings.currentWeek && pickDecl.status === 'down'
      ? myPick
      : null;
  const stalePickName = stalePick ? (profiles[stalePick]?.name ?? 'Your pick') : null;
  // The server says I've voted this round but this device doesn't know who for — my
  // sign-in expired or was freed, or site data got cleared, and I've signed back in.
  // My vote still counts; letting me vote again would count me twice. pendingUid
  // guards the instant mid-vote where the marker has landed but the pick hasn't.
  const votedWithoutPick =
    votingOpen && !myPick && !pendingUid && voters[myUid]?.weekKey === settings.currentWeek;
  // Voting is open and they haven't declared their status yet this week — the grid
  // stays hidden until they do, StatStatusGate above is all there is to see. Applies
  // to a revealer just like anyone else — they vote too now.
  const awaitingMyStatus = votingOpen && !myDeclaredStatus;

  return (
    <>
      <TopBar me={me} />
      <h1 className="m-0 mb-2 text-[clamp(24px,6vw,34px)] font-extrabold leading-[1.05] tracking-[-0.02em]">
        Star Player <em className="text-accent italic">of the Week</em>
      </h1>
      <p className="mb-7 max-w-[520px] text-sm leading-relaxed text-text-muted">
        Vote for the teammate who went above and beyond this week.
      </p>

      {/* The badge in TopBar is easy to miss, and Steph or OB may not expect to land
          here with extra controls — this spells out what having them means. Unlike
          the old single-host design, a revealer votes below just like anyone else. */}
      {canReveal && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-accent bg-accent/10 px-4 py-3 text-[13px] text-text">
          <IconEye className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" />
          <p className="m-0">
            {votingOpen ? (
              <>
                <span className="font-bold text-accent-ink">You can reveal this week's winner.</span> Vote below
                like everyone else — once you've checked around the office that everyone's voted, tap Reveal
                Winner at the bottom.
              </>
            ) : (
              <>
                <span className="font-bold text-accent-ink">You can open this week's voting.</span> Nobody can
                vote until you tap Start Voting below.
              </>
            )}
          </p>
        </div>
      )}

      {votingOpen && <StatStatusGate uid={myUid} current={myDeclaredStatus} />}

      {/* Everyone sees turnout — it's what tells a revealer whether it's actually
          worth checking around the office yet. Still only ever turnout, never a
          per-candidate breakdown, so seeing it carries no information advantage. */}
      {votingOpen && (
        <VotingProgress
          voters={voters}
          weekKey={settings.currentWeek}
          eligibleCount={roundParticipantCount(claims, voterUidsThisWeek)}
        />
      )}

      {!awaitingMyStatus && stalePickName && (
        <div
          role="status"
          className="mb-5 rounded-xl border border-accent bg-accent/10 px-4 py-3 text-[13px] leading-relaxed text-text"
        >
          <b className="text-accent-ink">Your vote for {stalePickName} doesn't count any more</b> — they switched to
          Stats Down, so they're off the poll. Tap someone else to vote again.
        </div>
      )}

      {!awaitingMyStatus && votedWithoutPick ? (
        <div
          role="status"
          className="mb-6 rounded-xl border border-border-soft bg-bg-elevated px-4 py-3 text-[13px] leading-relaxed text-text-muted"
        >
          <b className="text-text">Your vote's already in for this round, and it still counts.</b> It was cast before
          you were last signed out, so it can't be changed from here. One vote per person.
        </div>
      ) : awaitingMyStatus ? null : (
        <VoteGrid
          votingOpen={votingOpen}
          others={others}
          teammateCount={Object.keys(profiles).length - 1}
          myPick={stalePick ? null : myPick}
          pendingUid={pendingUid}
          onVote={castVote}
        />
      )}

      {canReveal && (
        <SessionControls votingOpen={votingOpen} hasVotes={votesCast > 0} revealing={!!settings.revealing} />
      )}
      <Suspense fallback={null}>{canReveal && <LazyManageTeamPanel />}</Suspense>
    </>
  );
}
