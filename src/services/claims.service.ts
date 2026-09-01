import { deleteDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { claimRef, db } from '@/lib/firebase';
import { AppValidationError } from '@/lib/errors';

/** Takes a name off the picker. Runs as a transaction so two taps landing at the same
 * moment can't both win it — the loser gets a clean "already taken" rather than
 * silently overwriting the winner. firestore.rules backs up the "can't overwrite"
 * half (the claim doc is create-only); nothing backs up the "this tap is really that
 * person" half — see lib/localIdentity.ts for why that's a deliberate gap now. */
export async function claimName(profileUid: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const existing = await tx.get(claimRef(profileUid));
    if (existing.exists()) {
      throw new AppValidationError(
        'Someone else is already using that name. Pick another, or ask KG to free it up.',
      );
    }
    tx.set(claimRef(profileUid), { claimedAt: serverTimestamp() });
  });
}

/** Hands the name back so someone else can take it — used when passing the device on,
 * or by the host freeing a name stuck on a browser nobody has any more. */
export function releaseName(profileUid: string): Promise<void> {
  return deleteDoc(claimRef(profileUid));
}
