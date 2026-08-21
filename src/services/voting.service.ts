import { doc, getDocs, runTransaction, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { db, myVoteRef, payoutsCol, settingsRef, tallyCol, balanceRef } from '@/lib/firebase';
import { BONUS_AMOUNT } from '@/lib/constants';
import { computeWinners } from '@/lib/winners';
import { getWeekLabel } from '@/lib/week';
import type { Profile } from '@/types/firestore';
import { increment } from 'firebase/firestore';

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
 * tally, work out the winner, and write it together with revealed:true in ONE batch
 * — so no client can ever observe revealed=true before the winner is actually known.
 *
 * A single winner is paid in that same batch, same as always. A tie is NOT paid here
 * — it's just announced (winnerUids has more than one entry) so everyone sees who
 * tied, and useAutoRunoff (SessionProvider) automatically reopens voting restricted
 * to just those names a few seconds later. Nobody is ever paid until exactly one
 * winner comes out of a round, whether that's this reveal or a later runoff's.
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

    // The reveal and the single-winner payout land in ONE batch: a failure here
    // must never leave revealed:true committed with the winner unpaid — that
    // state is invisible from the UI (WinnerBlock just says "+ B$300 awarded")
    // and, once revealed:true lands, the lock above refuses to run doReveal
    // again for this week, so there would be no way to retry.
    const batch = writeBatch(db);
    batch.set(
      settingsRef,
      { revealed: true, revealing: false, winnerUids, totalVotes, runoffUids: null },
      { merge: true },
    );
    if (winnerUids.length === 1) {
      const winnerUid = winnerUids[0]!;
      const winnerName = profiles[winnerUid]?.name ?? '';
      batch.set(balanceRef(winnerUid), { balance: increment(BONUS_AMOUNT) }, { merge: true });
      batch.set(doc(payoutsCol), {
        uid: winnerUid,
        name: winnerName,
        amount: BONUS_AMOUNT,
        week: getWeekLabel(),
        ts: serverTimestamp(),
      });
    }
    await batch.commit();
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

/** Fires on its own a few seconds after a tie is announced (see useAutoRunoff in
 * SessionProvider) — nobody clicks anything. Reuses the `revealing` flag as a claim
 * lock, the same trick doReveal uses, so at most one admin's client's attempt
 * proceeds even if several have the app open. Clears the tied round's votes and
 * tally, then reopens voting with everyone (except admins) free to vote again, but
 * only for one of `tiedUids` — enforced in firestore.rules, not just here. Returns
 * false if another client already handled this tie (or it's no longer current). */
export async function startRunoff(tiedUids: string[], profileUids: string[]): Promise<boolean> {
  const claimed = await runTransaction(db, async (tx) => {
    const snap = await tx.get(settingsRef);
    const s = snap.data();
    if (!s?.revealed || s.revealing || s.runoffUids || (s.winnerUids?.length ?? 0) <= 1) return false;
    tx.set(settingsRef, { revealing: true }, { merge: true });
    return true;
  });
  if (!claimed) return false;

  const batch = writeBatch(db);
  profileUids.forEach((uid) => batch.delete(myVoteRef(uid)));
  const tallySnap = await getDocs(tallyCol);
  tallySnap.forEach((d) => batch.delete(d.ref));
  batch.set(
    settingsRef,
    { revealed: false, revealing: false, winnerUids: [], totalVotes: 0, runoffUids: tiedUids, votingOpen: true },
    { merge: true },
  );
  await batch.commit();
  return true;
}

/** Escape hatch for a `revealing:true` lock that's stuck — e.g. the admin's tab
 * closed between the lock transaction committing and the rest of doReveal
 * running. The normal cleanup only fires from inside doReveal's own catch
 * block, so a lock stuck this way has no automatic recovery; this lets an
 * admin clear it from the UI instead of needing a direct Firestore edit. */
export function forceUnlockReveal() {
  return setDoc(settingsRef, { revealing: false }, { merge: true });
}

export function startVoting() {
  return setDoc(settingsRef, { votingOpen: true }, { merge: true });
}

export function endVoting() {
  return setDoc(settingsRef, { votingOpen: false }, { merge: true });
}

/** Nobody clicks a button for this — the moment the voting week changes (Friday,
 * per getWeekKey's Thursday-to-Friday boundary), whichever admin/owner happens to
 * have the app open silently clears the previous week's votes and opens a fresh
 * one — voting starts back up automatically rather than waiting on an admin to
 * click "Start Voting", so it's reliably open first thing Friday. Also clears any
 * runoff still in progress — if a tie never finished resolving before the week
 * rolled over, the new week just starts clean with the full team, same as if
 * nobody had revealed at all. */
export async function rollWeek(profiles: Record<string, Profile>, newWeekKey: string) {
  const batch = writeBatch(db);
  Object.keys(profiles).forEach((uid) => batch.delete(myVoteRef(uid)));
  const tallySnap = await getDocs(tallyCol);
  tallySnap.forEach((d) => batch.delete(d.ref));
  batch.set(
    settingsRef,
    {
      revealed: false,
      revealing: false,
      winnerUids: [],
      totalVotes: 0,
      runoffUids: null,
      votingOpen: true,
      currentWeek: newWeekKey,
    },
    { merge: true },
  );
  await batch.commit();
}
