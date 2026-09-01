import { addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { claimRef, profileRef, profilesCol, statStatusRef, voterRef } from '@/lib/firebase';
import { AppValidationError } from '@/lib/errors';

/** Adding someone is just a name now — no account, no email, no PIN, nothing to
 * hand over. They open the app, tap their name, and they're in. Firestore mints the
 * document id, which becomes their uid everywhere else. */
export function addTeammate(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new AppValidationError('Enter a name first.');
  }
  return addDoc(profilesCol, { name: trimmed });
}

/** Fixes a mistyped name without deleting and re-adding the person — a delete would
 * orphan their streak history for no reason. */
export function renameTeammate(uid: string, name: string) {
  return updateDoc(profileRef(uid), { name });
}

/** Note: if they'd already voted this week, that vote's count stays in the anonymous
 * tally — it can't be reversed, because reversing it would mean knowing who they
 * picked, and nothing anywhere records that. */
export async function removeTeammate(uid: string) {
  await deleteDoc(profileRef(uid));
  await Promise.allSettled([deleteDoc(claimRef(uid)), deleteDoc(voterRef(uid)), deleteDoc(statStatusRef(uid))]);
}

/** Frees a name that's stuck on a browser nobody has any more (lost phone, cleared
 * site data). The person keeps their profile, streaks and history — only the binding
 * to a device is dropped, so they can claim themselves again on the new one. */
export function releaseClaimFor(uid: string) {
  return deleteDoc(claimRef(uid));
}
