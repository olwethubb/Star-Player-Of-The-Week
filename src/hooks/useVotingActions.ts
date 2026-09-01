import { useCallback, useState } from 'react';
import * as votingService from '@/services/voting.service';
import { friendlyError } from '@/lib/errors';
import { useToast } from '@/hooks/useToast';
import { useSession } from '@/hooks/useSession';

export function useCastVote() {
  const { myUid, myPick, setMyPick, settings } = useSession();
  const { notify } = useToast();
  const [pendingUid, setPendingUid] = useState<string | null>(null);

  const castVote = useCallback(
    async (forUid: string) => {
      if (!myUid) return;
      setPendingUid(forUid);
      try {
        // The previous pick has to be handed in from here rather than read back from
        // the server — the server has never known it. See services/voting.service.ts.
        await votingService.castVote(myUid, forUid, myPick, settings.currentWeek, !!settings.votingOpen);
        setMyPick(forUid);
      } catch (err) {
        notify(friendlyError(err, 'Could not cast your vote. Try again in a moment.'));
      } finally {
        setPendingUid(null);
      }
    },
    [myUid, myPick, setMyPick, settings.currentWeek, settings.votingOpen, notify],
  );

  return { castVote, pendingUid };
}

export function useSessionControls() {
  const { notify } = useToast();
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async (action: () => Promise<unknown>, failure: string) => {
      setPending(true);
      try {
        await action();
      } catch (err) {
        notify(friendlyError(err, failure));
      } finally {
        setPending(false);
      }
    },
    [notify],
  );

  return {
    start: useCallback(() => run(votingService.startVoting, 'Could not start voting. Try again in a moment.'), [run]),
    end: useCallback(() => run(votingService.endVoting, 'Could not end voting. Try again in a moment.'), [run]),
    pending,
  };
}

export function useDoReveal() {
  const { profiles } = useSession();
  const { notify } = useToast();
  const [pending, setPending] = useState(false);

  const reveal = useCallback(async () => {
    setPending(true);
    try {
      const done = await votingService.doReveal(profiles);
      if (!done) {
        notify(
          'Nothing happened — this week may already be revealed, or a reveal is in progress. Try again in a moment.',
        );
      }
    } catch (err) {
      notify(friendlyError(err, 'Could not reveal the results. Try again in a moment.'));
    } finally {
      setPending(false);
    }
  }, [profiles, notify]);

  return { reveal, pending };
}

export function useForceUnlockReveal() {
  const { notify } = useToast();
  const [pending, setPending] = useState(false);

  const forceUnlock = useCallback(async () => {
    setPending(true);
    try {
      await votingService.forceUnlockReveal();
    } catch (err) {
      notify(friendlyError(err, 'Could not clear the lock. Try again in a moment.'));
    } finally {
      setPending(false);
    }
  }, [notify]);

  return { forceUnlock, pending };
}
