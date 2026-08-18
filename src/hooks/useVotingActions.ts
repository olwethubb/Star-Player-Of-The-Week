import { useCallback, useState } from 'react';
import * as votingService from '@/services/voting.service';
import { friendlyError } from '@/lib/errors';
import { useToast } from '@/hooks/useToast';
import type { Profile } from '@/types/firestore';

export function useCastVote(myUid: string, votingOpen: boolean) {
  const { notify } = useToast();
  const [pendingUid, setPendingUid] = useState<string | null>(null);

  const castVote = useCallback(
    async (forUid: string) => {
      setPendingUid(forUid);
      try {
        await votingService.castVote(myUid, forUid, votingOpen);
      } catch (err) {
        notify(friendlyError(err, 'Could not cast your vote. Try again in a moment.'));
      } finally {
        setPendingUid(null);
      }
    },
    [myUid, votingOpen, notify],
  );

  return { castVote, pendingUid };
}

export function useSessionControls() {
  const { notify } = useToast();
  const [pending, setPending] = useState(false);

  const start = useCallback(async () => {
    setPending(true);
    try {
      await votingService.startVoting();
    } catch (err) {
      notify(friendlyError(err, 'Could not start voting. Try again in a moment.'));
    } finally {
      setPending(false);
    }
  }, [notify]);

  const end = useCallback(async () => {
    setPending(true);
    try {
      await votingService.endVoting();
    } catch (err) {
      notify(friendlyError(err, 'Could not end voting. Try again in a moment.'));
    } finally {
      setPending(false);
    }
  }, [notify]);

  return { start, end, pending };
}

export function useDoReveal(profiles: Record<string, Profile>) {
  const { notify } = useToast();
  const [pending, setPending] = useState(false);

  const reveal = useCallback(async () => {
    setPending(true);
    try {
      const done = await votingService.doReveal(profiles);
      if (!done) {
        notify('Nothing happened — this week may already be revealed, or another reveal is in progress. Try again in a moment.');
      }
    } catch (err) {
      notify(friendlyError(err, 'Could not reveal the results. Try again in a moment.'));
    } finally {
      setPending(false);
    }
  }, [profiles, notify]);

  return { reveal, pending };
}
