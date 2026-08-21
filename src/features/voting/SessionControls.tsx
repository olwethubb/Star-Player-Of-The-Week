import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useDoReveal, useForceUnlockReveal, useSessionControls } from '@/hooks/useVotingActions';
import type { Profile } from '@/types/firestore';

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

/** Only an admin can open/close the voting window or trigger a reveal — and reveal is
 * only offered once voting is closed, so results can't be tallied while votes are
 * still trickling in. */
export function SessionControls({
  votingOpen,
  revealing,
  profiles,
}: {
  votingOpen: boolean;
  revealing: boolean;
  profiles: Record<string, Profile>;
}) {
  const { start, end, pending: sessionPending } = useSessionControls();
  const { reveal, pending: revealPending } = useDoReveal(profiles);
  const [confirmingEnd, setConfirmingEnd] = useState(false);

  if (votingOpen) {
    return (
      <>
        <Button variant="primary" disabled={sessionPending} onClick={() => setConfirmingEnd(true)}>
          End Voting
        </Button>
        <ConfirmDialog
          open={confirmingEnd}
          onOpenChange={setConfirmingEnd}
          title="End voting now?"
          description="Nobody will be able to vote again until you start a new session."
          confirmLabel="End Voting"
          onConfirm={end}
        />
      </>
    );
  }

  return (
    <div className="mb-5 flex flex-col gap-2.5">
      <StuckRevealBanner revealing={revealing} />
      <Button variant="ghost" className="w-full" disabled={sessionPending} onClick={() => start()}>
        Start Voting
      </Button>
      <Button variant="primary" className="mb-0" disabled={revealPending} onClick={() => reveal()}>
        {revealPending ? 'Revealing…' : 'Reveal Results'}
      </Button>
    </div>
  );
}
