import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useDoReveal, useForceUnlockReveal, useStartNewRound, useStartVoting } from '@/hooks/useVotingActions';

const STUCK_LOCK_GRACE_MS = 15_000;

/** A normal reveal clears `revealing` almost instantly (it's one transaction plus
 * one batch). If it's still true after a real pause, the most likely explanation
 * is a crash/closed tab between claiming the lock and finishing — with no
 * self-recovery, that would silently block every future reveal for the week. This
 * shows a "force unlock" escape hatch once it's been stuck longer than any real
 * reveal should ever take. */
function StuckRevealBanner({ revealing }: { revealing: boolean }) {
  const [stuck, setStuck] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const sinceRef = useRef<number | null>(null);
  const { forceUnlock, pending } = useForceUnlockReveal();

  useEffect(() => {
    if (!revealing) {
      sinceRef.current = null;
      setStuck(false);
      return;
    }
    sinceRef.current ??= Date.now();
    const elapsed = Date.now() - sinceRef.current;
    if (elapsed >= STUCK_LOCK_GRACE_MS) {
      setStuck(true);
      return;
    }
    const timer = setTimeout(() => setStuck(true), STUCK_LOCK_GRACE_MS - elapsed);
    return () => clearTimeout(timer);
  }, [revealing]);

  if (!stuck) return null;

  return (
    <div className="mb-3.5 rounded-xl border border-accent/40 bg-accent/5 px-3.5 py-2.5 text-[13px]">
      <p className="m-0 mb-2">
        A reveal attempt seems stuck — likely a closed tab or lost connection mid-reveal. Nobody can reveal results
        again until this is cleared.
      </p>
      <Button variant="small" disabled={pending} onClick={() => setConfirming(true)}>
        {pending ? 'Clearing…' : 'Force unlock'}
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Force unlock the reveal lock?"
        description="Only do this if you're sure no reveal is genuinely in progress right now — clearing it while one is actually running could let two reveals race."
        confirmLabel="Force unlock"
        danger
        onConfirm={forceUnlock}
      />
    </div>
  );
}

/** Wipes the current round's votes and locks voting again — available any time,
 * independent of Reveal Winner entirely. For when a round needs re-running before
 * anyone's revealed anything (someone mis-voted, a candidate needs pulling); a fresh
 * Start Voting tap is needed afterward, same as any other locked start, before anyone
 * can vote again. Not just for mid-session use — the results page has its own copy of
 * this for after a reveal already happened, since this component doesn't render
 * there. */
function ResetVotingButton() {
  const { startNewRound, pending } = useStartNewRound();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <Button variant="ghost" className="w-full" disabled={pending} onClick={() => setConfirming(true)}>
        {pending ? 'Resetting…' : 'Reset Voting'}
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Reset voting for this round?"
        description="Every vote cast so far this round is cleared and voting locks again — nobody's pick carries over, and you'll need to tap Start Voting before anyone can vote again. Use this if something needs correcting before anyone reveals."
        confirmLabel="Reset Voting"
        danger
        onConfirm={startNewRound}
      />
    </>
  );
}

/** Shown when voting's locked — nothing to reveal or reset yet, so this is the only
 * control: the deliberate "we're voting now" tap that unlocks the vote screen for
 * everyone signed in, revealer included. No confirm step — opening voting isn't
 * destructive the way closing or resetting it is. */
function StartVotingButton() {
  const { start, pending } = useStartVoting();
  return (
    <Button variant="primary" className="mb-0" disabled={pending} onClick={() => start()}>
      {pending ? 'Opening…' : 'Start Voting'}
    </Button>
  );
}

/** Whoever's claimed KG, Steph, or OB sees this. Voting is locked (nobody can vote,
 * and everyone sees a "voting hasn't started" screen — see VoteGrid) until one of
 * them taps Start Voting; from there, Reveal Winner closes voting and works out the
 * winner in one action, and Reset Voting is the escape hatch for everything short of
 * that — wipe the round and lock it again without revealing anything. It's on
 * whoever clicks Reveal Winner to have actually checked everyone's voted first (by
 * asking around the office) — nothing here tracks that, hence the confirm step.
 *
 * Reveal Winner itself doesn't exist at all until at least one vote's been cast —
 * revealing an empty round has nothing to show (computeWinners returns no winner for
 * zero votes), so there's nothing useful for it to do yet. */
export function SessionControls({
  votingOpen,
  hasVotes,
  revealing,
}: {
  votingOpen: boolean;
  hasVotes: boolean;
  revealing: boolean;
}) {
  const { reveal, pending } = useDoReveal();
  const [confirming, setConfirming] = useState(false);

  if (!votingOpen) {
    return (
      <div className="mb-5">
        <StuckRevealBanner revealing={revealing} />
        <StartVotingButton />
      </div>
    );
  }

  return (
    <div className="mb-5 flex flex-col gap-2.5">
      <StuckRevealBanner revealing={revealing} />
      {hasVotes ? (
        <>
          <Button variant="primary" className="mb-0" disabled={pending} onClick={() => setConfirming(true)}>
            {pending ? 'Revealing…' : 'Reveal Winner'}
          </Button>
          <ConfirmDialog
            open={confirming}
            onOpenChange={setConfirming}
            title="Reveal this week's winner?"
            description="Make sure everyone who's voting has actually voted first — this closes voting for the week, and nobody can vote again until a new round starts."
            confirmLabel="Reveal Winner"
            onConfirm={reveal}
          />
        </>
      ) : (
        <p className="m-0 rounded-xl border border-dashed border-border px-4 py-3 text-center text-[13px] text-text-muted">
          Reveal Winner shows up here once at least one vote's been cast.
        </p>
      )}
      <ResetVotingButton />
    </div>
  );
}
