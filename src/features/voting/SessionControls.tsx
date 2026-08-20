import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useDoReveal, useSessionControls } from '@/hooks/useVotingActions';
import type { Profile } from '@/types/firestore';

/** Only an admin can open/close the voting window or trigger a reveal — and reveal is
 * only offered once voting is closed, so results can't be tallied while votes are
 * still trickling in. */
export function SessionControls({ votingOpen, profiles }: { votingOpen: boolean; profiles: Record<string, Profile> }) {
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
      <Button variant="ghost" className="w-full" disabled={sessionPending} onClick={() => start()}>
        Start Voting
      </Button>
      <Button variant="primary" className="mb-0" disabled={revealPending} onClick={() => reveal()}>
        {revealPending ? 'Revealing…' : 'Reveal Results'}
      </Button>
    </div>
  );
}
