import { deleteDoc, getDoc, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore';
import { claimRef, db, hostRef, profileRef } from '@/lib/firebase';
import { AppValidationError } from '@/lib/errors';
import { isHostName } from '@/types/firestore';

/** Takes a name off the picker and binds it to this browser. Runs as a transaction
 * so two people tapping the same name at the same moment can't both win it — the
 * loser gets a clean "already taken" rather than silently overwriting the winner.
 * firestore.rules backs this up (the claim doc is create-only), so this isn't the
 * only thing standing between one name and two voters.
 *
 * If the name is KG, the claimer is also registered as the session host — see
 * registerHost. That's a second write rather than part of this transaction because
 * the rule guarding it has to be able to see the claim already committed. */
export async function claimName(profileUid: string, authUid: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const existing = await tx.get(claimRef(profileUid));
    if (existing.exists()) {
      if (existing.data().authUid === authUid) return; // already ours — nothing to do
      throw new AppValidationError(
        'Someone else is already using that name. Pick another, or ask KG to free it up.',
      );
    }
    tx.set(claimRef(profileUid), { authUid, claimedAt: serverTimestamp() });
  });

  const profile = await getDoc(profileRef(profileUid));
  if (isHostName(profile.data()?.name)) {
    await registerHost(profileUid, authUid);
  }
}

/** Hands the name back so someone else can take it — used when passing the device
 * on. Also stands down as host if that's the name being released, otherwise the
 * next person to claim KG would be locked out of the controls by a stale host doc. */
export async function releaseName(profileUid: string, isHost: boolean): Promise<void> {
  if (isHost) {
    await deleteDoc(hostRef).catch(() => {
      // Not fatal — the claim delete below is what actually frees the name, and a
      // stale host doc is recoverable by whoever claims KG next (they overwrite it).
    });
  }
  await deleteDoc(claimRef(profileUid));
}

/** Records the caller as the session host. The rules only permit this when the
 * caller genuinely holds the claim on a profile named KG, so it can't be used to
 * nominate yourself or anybody else. Safe to call repeatedly — it overwrites,
 * which is exactly what lets a new KG take over from one whose browser was wiped. */
export function registerHost(profileUid: string, authUid: string) {
  return setDoc(hostRef, { authUid, profileUid });
}
