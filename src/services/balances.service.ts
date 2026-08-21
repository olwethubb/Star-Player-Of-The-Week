import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { balanceAdjustmentsCol, balanceRef, db } from '@/lib/firebase';

/** Writes the new balance and a record of who changed it and from what, in one
 * batch — so a manual correction is never silently untraceable later. `from`
 * is whatever the caller already has on hand from the live snapshot; this is
 * an audit trail, not itself a source of truth, so it doesn't need a
 * transaction re-read to be useful. */
export function updateBalance(uid: string, value: number, from: number, adjustedBy: string) {
  if (Number.isNaN(value)) return Promise.resolve();
  const batch = writeBatch(db);
  batch.set(balanceRef(uid), { balance: value }, { merge: true });
  batch.set(doc(balanceAdjustmentsCol), { uid, from, to: value, adjustedBy, ts: serverTimestamp() });
  return batch.commit();
}
