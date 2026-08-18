import { doc, getDocs, runTransaction, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { db, myVoteRef, payoutsCol, settingsRef, tallyCol, balanceRef } from '@/lib/firebase';
import { BONUS_AMOUNT } from '@/lib/constants';
import { computeWinners } from '@/lib/winners';
import { getWeekLabel } from '@/lib/week';
import type { Profile } from '@/types/firestore';
import { increment, arrayUnion } from 'firebase/firestore';

/** Casting a vote never reads anyone else's vote — old and new tally docs are nudged with
 * an atomic increment/decrement, so the only read in this transaction is your own vote record. */
export async function castVote(myUid: string, forUid: string, votingOpen: boolean) {
  if (!votingOpen || forUid === myUid) return;
  const voteRef = myVoteRef(myUid);
  await runTransaction(db, async (tx) => {
    const mySnap = await tx.get(voteRef);
    const prev = mySnap.exists() ? mySnap.data().votedForUid : null;
    if (prev === forUid) return;
    tx.set(doc(tallyCol, forUid), { count: increment(1) }, { merge: true });
    if (prev) {
      tx.set(doc(tallyCol, prev), { count: increment(-1) }, { merge: true });
    }
    tx.set(voteRef, { votedForUid: forUid, ts: serverTimestamp() });
  });
}

/** Reveal happens in two steps: (1) atomically claim a "revealing" lock so only one
 * admin's click proceeds even if two click at once, then (2) read the now-unlocked
 * tally, work out the winner, and write it together with revealed:true in ONE write —
 * so no client can ever observe revealed=true before the winner is actually known.
 * Returns false if nothing happened (already revealed/revealing). */
export async function doReveal(profiles: Record<string, Profile>): Promise<boolean> {
  let claimedLock = false;
  try {
    const claimed = await runTransaction(db, async (tx) => {
      const snap = await tx.get(settingsRef);
      const s = snap.data();
      if (s?.revealed || s?.revealing) return false;
      tx.set(settingsRef, { revealing: true }, { merge: true });
      return true;
    });
    claimedLock = claimed;
    if (!claimed) return false;

    const tallySnap = await getDocs(tallyCol);
    const tally: Record<string, number> = {};
    tallySnap.forEach((d) => (tally[d.id] = d.data().count || 0));
    Object.keys(profiles).forEach((uid) => {
      if (!(uid in tally)) tally[uid] = 0;
    });

    const { winnerUids, totalVotes } = computeWinners(tally);
    await setDoc(settingsRef, { revealed: true, revealing: false, winnerUids, totalVotes }, { merge: true });

    if (winnerUids.length === 1) {
      const winnerUid = winnerUids[0]!;
      const winnerName = profiles[winnerUid]?.name ?? '';
      const batch = writeBatch(db);
      batch.set(balanceRef(winnerUid), { balance: increment(BONUS_AMOUNT) }, { merge: true });
      batch.set(doc(payoutsCol), {
        uid: winnerUid,
        name: winnerName,
        amount: BONUS_AMOUNT,
        week: getWeekLabel(),
        ts: serverTimestamp(),
      });
      await batch.commit();
    }
    return true;
  } catch (err) {
    // If we'd already claimed the lock, an error past this point (a flaky tally read, a
    // bonus batch that failed, etc.) must not leave revealing:true stuck — that would
    // silently block every future reveal attempt for this week. Release the lock.
    if (claimedLock) {
      await setDoc(settingsRef, { revealing: false }, { merge: true }).catch(() => {});
    }
    throw err;
  }
}

export async function awardBonus(uid: string, profile: Profile, alreadyAwarded: boolean) {
  if (alreadyAwarded) return;
  const batch = writeBatch(db);
  batch.set(balanceRef(uid), { balance: increment(BONUS_AMOUNT) }, { merge: true });
  batch.set(doc(payoutsCol), { uid, name: profile.name, amount: BONUS_AMOUNT, week: getWeekLabel(), ts: serverTimestamp() });
  batch.set(settingsRef, { bonusAwardedUids: arrayUnion(uid) }, { merge: true });
  await batch.commit();
}

export function startVoting() {
  return setDoc(settingsRef, { votingOpen: true }, { merge: true });
}

export function endVoting() {
  return setDoc(settingsRef, { votingOpen: false }, { merge: true });
}

/** Nobody clicks a button for this — the moment the calendar week changes, whichever
 * admin/owner happens to have the app open silently clears the previous week's votes
 * and opens a fresh one, whether or not anyone got around to revealing the last one. */
export async function rollWeek(profileUids: string[], newWeekKey: string) {
  const batch = writeBatch(db);
  profileUids.forEach((uid) => batch.delete(myVoteRef(uid)));
  const tallySnap = await getDocs(tallyCol);
  tallySnap.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  await setDoc(
    settingsRef,
    {
      revealed: false,
      revealing: false,
      bonusAwardedUids: [],
      winnerUids: [],
      totalVotes: 0,
      votingOpen: false,
      currentWeek: newWeekKey,
    },
    { merge: true },
  );
}
