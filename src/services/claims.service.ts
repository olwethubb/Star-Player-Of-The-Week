import { getDoc, runTransaction, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { claimRef, db, statStatusRef } from '@/lib/firebase';
import { AppValidationError } from '@/lib/errors';
import { CLAIM_STALE_AFTER_MS } from '@/lib/constants';
import { findStaleClaimUids } from '@/lib/roundRules';
import type { Claim, StatDeclaration } from '@/types/firestore';

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

/** Hands the name back so someone else can take it — used by Home, the auto sign-out
 * after a reveal, and a revealer freeing a name stuck on a browser nobody has any
 * more. Wipes the stats-up/down choice along with the claim, so whoever takes the
 * name next starts clean instead of inheriting it — except a Stats Down choice, which
 * stays: Down takes away the votes you'd received, and going Home mustn't be a way to
 * undo that. Taking back the person's own vote isn't done here — only their own
 * device knows who they picked, so Home does that first (see releaseName in
 * SessionProvider.tsx). */
export async function releaseName(profileUid: string): Promise<void> {
  const stat = await getDoc(statStatusRef(profileUid));
  const batch = writeBatch(db);
  batch.delete(claimRef(profileUid));
  if (stat.data()?.status !== 'down') batch.delete(statStatusRef(profileUid));
  await batch.commit();
}

/** The heartbeat: called every CLAIM_HEARTBEAT_MS by whichever browser holds this
 * claim, for as long as it's actually open — see the effect in SessionProvider.tsx.
 * firestore.rules only allows this one field to move on an existing claim, so there's
 * no way for this to repoint whose name it is, only to prove a browser's still
 * around. A failure here is never surfaced to the person using the app — missing one
 * heartbeat just means the claim looks very slightly less fresh than it is, not that
 * anything broke for them. */
export function touchClaim(profileUid: string): Promise<void> {
  return setDoc(claimRef(profileUid), { lastSeenAt: serverTimestamp() }, { merge: true });
}

/** Frees up any claim nobody's refreshed in longer than CLAIM_STALE_AFTER_MS — a
 * closed tab, a dead phone, someone who left without tapping Home — so the turnout
 * count reflects who's actually around. See findStaleClaimUids in lib/roundRules.ts
 * for what's never swept (anyone Up this week, in-flight heartbeats) and why a fast
 * device clock can't cause it. Only the claim goes: the stats choice stays, so an
 * expired sign-in never changes whose votes count. Run from every open tab, not just
 * a revealer's — see SessionProvider.tsx. */
export async function releaseStaleClaims(
  claims: Record<string, Claim>,
  statuses: Record<string, StatDeclaration>,
  currentWeek: string | null,
): Promise<void> {
  const staleUids = findStaleClaimUids(claims, statuses, currentWeek, CLAIM_STALE_AFTER_MS, Date.now());
  if (staleUids.length === 0) return;

  const batch = writeBatch(db);
  staleUids.forEach((uid) => batch.delete(claimRef(uid)));
  await batch.commit();
}
