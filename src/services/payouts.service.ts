import { addDoc, doc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { balanceRef, db, payoutRequestsCol } from '@/lib/firebase';
import { AppValidationError } from '@/lib/errors';
import type { Profile } from '@/types/firestore';

export function requestCashout(
  uid: string,
  profile: Profile,
  amount: number,
  hasPendingRequest: boolean,
  currentBalance: number,
) {
  const amt = Math.floor(amount);
  if (hasPendingRequest || !(amt > 0) || amt > currentBalance) return Promise.resolve();
  return addDoc(payoutRequestsCol, {
    uid,
    name: profile.name,
    amount: amt,
    status: 'pending',
    requestedAt: serverTimestamp(),
    resolvedAt: null,
    resolvedBy: null,
  });
}

export function cancelCashout(requestId: string) {
  return updateDoc(doc(payoutRequestsCol, requestId), {
    status: 'cancelled',
    resolvedAt: serverTimestamp(),
  });
}

export async function approvePayout(requestId: string, resolvedBy: string) {
  const reqRef = doc(payoutRequestsCol, requestId);
  await runTransaction(db, async (tx) => {
    const reqSnap = await tx.get(reqRef);
    if (!reqSnap.exists()) return;
    const req = reqSnap.data();
    if (req.status !== 'pending') return;

    const balRef = balanceRef(req.uid);
    const balSnap = await tx.get(balRef);
    const balance = balSnap.data()?.balance ?? 0;
    if (balance < req.amount) {
      throw new AppValidationError(
        balSnap.exists()
          ? `${req.name}'s balance is now only B$${balance} — lower than this B$${req.amount} request. Reject it, or raise their balance in Team & balances first.`
          : `${req.name} no longer has a balance on record (they may have been removed) — reject this request, or set a balance for them in Team & balances first.`,
      );
    }
    tx.update(balRef, { balance: balance - req.amount });
    tx.update(reqRef, { status: 'paid', resolvedAt: serverTimestamp(), resolvedBy });
  });
}

export function rejectPayout(requestId: string, resolvedBy: string) {
  return updateDoc(doc(payoutRequestsCol, requestId), {
    status: 'rejected',
    resolvedAt: serverTimestamp(),
    resolvedBy,
  });
}
