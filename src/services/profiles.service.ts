import { createUserWithEmailAndPassword, deleteUser, signOut } from 'firebase/auth';
import { deleteDoc, setDoc, updateDoc } from 'firebase/firestore';
import { withSecondaryAuth } from '@/lib/firebase-secondary';
import { balanceRef, myVoteRef, profileRef, settingsRef } from '@/lib/firebase';
import type { Role } from '@/types/firestore';

/** Creates a teammate's Auth user via a throwaway secondary app, so the admin doing
 * this stays signed in — then writes their profile + a zero balance. If either write
 * fails, the just-created Auth user is deleted before the error propagates: without
 * this, that email would be permanently claimed and unrecoverable through the UI —
 * the admin's only retry would then fail with "already in use" forever. */
export async function createTeamMember(name: string, email: string, password: string, role: Role) {
  await withSecondaryAuth(async (secondaryAuth) => {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    try {
      await Promise.all([
        setDoc(profileRef(cred.user.uid), { name, email, role }),
        setDoc(balanceRef(cred.user.uid), { balance: 0 }),
      ]);
    } catch (err) {
      await deleteUser(cred.user).catch(() => {});
      throw err;
    } finally {
      await signOut(secondaryAuth).catch(() => {});
    }
  });
}

/** Fixes a mistyped name without deleting and re-adding the person — a delete
 * would orphan their balance/vote/payout history for no reason. Deliberately
 * name-only: their Firestore `email` field is just a display value, but their
 * actual Auth login email lives on the Auth account itself and can't be changed
 * from here, so editing it here would silently stop matching what they sign in
 * with. */
export function renameTeammate(uid: string, name: string) {
  return updateDoc(profileRef(uid), { name });
}

/** Note: if they'd already voted this week, that vote's count stays in the anonymous
 * tally — it can't be reversed without knowing who they picked, which nobody may see. */
export async function removeTeammate(uid: string) {
  await deleteDoc(profileRef(uid));
  await Promise.allSettled([deleteDoc(myVoteRef(uid)), deleteDoc(balanceRef(uid))]);
}

export function setRole(uid: string, newRole: Role) {
  return updateDoc(profileRef(uid), { role: newRole });
}

// Two explicit actions rather than one "toggle" — a toggle has to trust a
// currentFinanceUid value handed to it from a possibly-stale render, and
// getting that stale read wrong flips the intent (a click meant to REMOVE
// finance from someone can silently ASSIGN it to them instead, if another
// admin's change hadn't reached this client yet). Each of these does exactly
// one unambiguous thing regardless of what this client currently believes.
export function assignFinanceHolder(uid: string) {
  return setDoc(settingsRef, { financeUid: uid }, { merge: true });
}

export function clearFinanceHolder() {
  return setDoc(settingsRef, { financeUid: null }, { merge: true });
}
