import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { deleteDoc, setDoc, updateDoc } from 'firebase/firestore';
import { withSecondaryAuth } from '@/lib/firebase-secondary';
import { balanceRef, myVoteRef, profileRef, settingsRef } from '@/lib/firebase';
import type { Role } from '@/types/firestore';

/** Creates a teammate's Auth user via a throwaway secondary app, so the admin doing
 * this stays signed in — then writes their profile + a zero balance. */
export async function createTeamMember(name: string, email: string, password: string, role: Role) {
  const uid = await withSecondaryAuth(async (secondaryAuth) => {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await signOut(secondaryAuth);
    return cred.user.uid;
  });
  await Promise.all([
    setDoc(profileRef(uid), { name, email, role }),
    setDoc(balanceRef(uid), { balance: 0 }),
  ]);
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

export function setFinanceHolder(currentFinanceUid: string | null, uid: string) {
  const next = currentFinanceUid === uid ? null : uid;
  return setDoc(settingsRef, { financeUid: next }, { merge: true });
}
