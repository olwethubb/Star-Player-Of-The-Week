import { useCallback, useState } from 'react';
import * as payoutsService from '@/services/payouts.service';
import { friendlyError } from '@/lib/errors';
import { useToast } from '@/hooks/useToast';
import type { Profile } from '@/types/firestore';

export function useRequestCashout(uid: string, profile: Profile, hasPendingRequest: boolean, currentBalance: number) {
  const { notify } = useToast();
  const [pending, setPending] = useState(false);

  const requestCashout = useCallback(
    async (amount: number) => {
      setPending(true);
      try {
        await payoutsService.requestCashout(uid, profile, amount, hasPendingRequest, currentBalance);
      } catch (err) {
        notify(friendlyError(err, 'Could not submit that cash-out request. Try again in a moment.'));
      } finally {
        setPending(false);
      }
    },
    [uid, profile, hasPendingRequest, currentBalance, notify],
  );

  return { requestCashout, pending };
}

export function useCancelCashout() {
  const { notify } = useToast();
  return useCallback(
    (requestId: string) =>
      payoutsService
        .cancelCashout(requestId)
        .catch((err) => notify(friendlyError(err, 'Could not cancel that request. Try again in a moment.'))),
    [notify],
  );
}

export function useApprovePayout(resolvedBy: string) {
  const { notify } = useToast();
  return useCallback(
    (requestId: string) =>
      payoutsService
        .approvePayout(requestId, resolvedBy)
        .catch((err) => notify(friendlyError(err, 'Could not approve that payout. Try again in a moment.'))),
    [resolvedBy, notify],
  );
}

export function useRejectPayout(resolvedBy: string) {
  const { notify } = useToast();
  return useCallback(
    (requestId: string) =>
      payoutsService
        .rejectPayout(requestId, resolvedBy)
        .catch((err) => notify(friendlyError(err, 'Could not reject that request. Try again in a moment.'))),
    [resolvedBy, notify],
  );
}
