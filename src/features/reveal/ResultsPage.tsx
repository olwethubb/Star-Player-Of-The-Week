import { Suspense, useEffect, useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LazyManageTeamPanel } from '@/features/team-admin/ManageTeamPanel.lazy';
import { RESULTS_AUTO_SIGNOUT_MS } from '@/lib/constants';
import { useStartNewRound } from '@/hooks/useVotingActions';
import { useSession } from '@/hooks/useSession';
import { WinnerBlock } from './WinnerBlock';

/** Everyone except a revealer (KG, Steph, or OB) only gets to look at the result, not
 * linger on it — after a short read, this signs them out (the same thing Home
 * does) and drops them back on the name picker, so the app doesn't stay "logged in"
 * as them indefinitely once their part is done. A revealer stays, since the session
 * controls below the result are theirs to use. This component unmounts whenever
 * `revealed` goes back to false (a new round, next week), so a fresh mount
 * next time starts a fresh timer — nobody gets signed out early because of a
 * previous week's reveal. */
function useAutoSignOutAfterReveal() {
  const { canReveal, releaseName } = useSession();

  useEffect(() => {
    if (canReveal) return;
    const timer = setTimeout(() => {
      releaseName().catch((err) => console.warn('Automatic sign-out failed:', err instanceof Error ? err.message : err));
    }, RESULTS_AUTO_SIGNOUT_MS);
    return () => clearTimeout(timer);
  }, [canReveal, releaseName]);
}

/** Without this a revealer is stranded after a reveal: the results page replaces the
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
        description="This week's result is cleared and voting locks again — you'll need to tap Start Voting before anyone can vote. Use this if the round needs re-running before Friday."
        confirmLabel="Start a new vote"
        danger
        onConfirm={startNewRound}
      />
    </div>
  );
}

export function ResultsPage() {
  const { me, profiles, settings, canReveal } = useSession();
  useAutoSignOutAfterReveal();

  if (!me) return null;

  const total = settings.totalVotes || 0;

  return (
    <>
      <TopBar me={me} />
      <p className="mb-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-text-muted">Results</p>
      <h1 className="m-0 mb-5 text-[clamp(22px,5vw,30px)] font-extrabold leading-[1.05] tracking-[-0.02em]">
        {total} vote{total === 1 ? '' : 's'} cast this week
      </h1>

      <WinnerBlock settings={settings} profiles={profiles} />

      {canReveal && <StartNewRound />}

      {canReveal && (
        <p className="mb-5 text-xs text-text-muted">
          A new week also starts on its own each Friday — you'll still need to tap Start Voting once it does.
        </p>
      )}
      <Suspense fallback={null}>{canReveal && <LazyManageTeamPanel />}</Suspense>
    </>
  );
}
