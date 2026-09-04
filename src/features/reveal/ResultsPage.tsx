import { Suspense, useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LazyManageTeamPanel } from '@/features/team-admin/ManageTeamPanel.lazy';
import { VotingProgress } from '@/features/voting/VotingProgress';
import { useStartNewRound } from '@/hooks/useVotingActions';
import { useSession } from '@/hooks/useSession';
import { WinnerBlock } from './WinnerBlock';

/** Without this the host is stranded after a reveal: the results page replaces the
 * vote screen entirely (so the session controls are gone), and the automatic rollover
 * only fires when the calendar week actually changes — so a reveal on a Monday would
 * lock the vote until Friday with no way back. */
function StartNewRound() {
  const { startNewRound, pending } = useStartNewRound();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="mb-5">
      <Button variant="ghost" className="w-full" disabled={pending} onClick={() => setConfirming(true)}>
        {pending ? 'Starting…' : 'Start a new vote'}
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Start a new vote now?"
        description="This week's result is cleared and voting reopens from scratch — everyone votes again. Use this if the round needs re-running before Friday."
        confirmLabel="Start a new vote"
        danger
        onConfirm={startNewRound}
      />
    </div>
  );
}

export function ResultsPage() {
  const { me, profiles, claims, settings, voters, isHost, canManageTeam } = useSession();

  if (!me) return null;

  const total = settings.totalVotes || 0;

  return (
    <>
      <TopBar me={me} />
      <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted">Results</p>
      <h1 className="m-0 mb-5 font-serif text-[clamp(22px,5vw,30px)] font-bold italic leading-[1.15]">
        {total} vote{total === 1 ? '' : 's'} cast this week
      </h1>

      <WinnerBlock settings={settings} profiles={profiles} />

      {/* Turnout only, never a per-candidate breakdown — how many of the claimed
          names voted, not who they voted for or how the count split. */}
      {isHost && (
        <VotingProgress voters={voters} weekKey={settings.currentWeek} eligibleCount={Object.keys(claims).length} />
      )}

      {isHost && <StartNewRound />}

      {isHost && (
        <p className="mb-5 text-xs text-text-muted">Voting also reopens on its own each Friday, when the new week starts.</p>
      )}
      <Suspense fallback={null}>{canManageTeam && <LazyManageTeamPanel />}</Suspense>
    </>
  );
}
