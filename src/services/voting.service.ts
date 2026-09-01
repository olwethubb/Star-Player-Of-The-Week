import { doc, getDocs, increment, runTransaction, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { db, settingsRef, tallyCol, voterRef, votersCol, weeklyActivityRef } from '@/lib/firebase';
import { computeWinners } from '@/lib/winners';
import { getWeekKey } from '@/lib/week';
import { clearLocalPick, setLocalPick } from '@/lib/localPick';
import type { Profile } from '@/types/firestore';

/** Casting a vote writes three things, and deliberately never writes a fourth:
 *
 *   sotw_tally/{candidate}  +1   (and -1 off the previous pick, if changing)
 *   sotw_voters/{me}             a marker saying only THAT I voted
 *   localStorage                 who I actually picked — this browser only
 *
 * The link between voter and candidate never reaches the server. That's why the
 * previous pick has to be passed in from the caller rather than read back: there is
 * nothing on the server to read it from, by design. See lib/localPick.ts.
 *
 * The tally nudges are atomic increments, so two people voting at once can't clobber
 * each other's count. */
export async function castVote(
  myUid: string,
  forUid: string,
  previousPick: string | null,
  weekKey: string | null,
  votingOpen: boolean,
) {
  if (!votingOpen || forUid === myUid || previousPick === forUid) return;

  const batch = writeBatch(db);
  batch.set(doc(tallyCol, forUid), { count: increment(1) }, { merge: true });
  if (previousPick) {
    batch.set(doc(tallyCol, previousPick), { count: increment(-1) }, { merge: true });
  }
  batch.set(voterRef(myUid), { weekKey: getWeekKey(), ts: serverTimestamp() });
  await batch.commit();

  // Only after the write lands — a failed vote must not leave this browser
  // believing it picked someone the tally never counted.
  setLocalPick(weekKey, forUid);
}

/** Reveal happens in two steps: (1) atomically claim a "revealing" lock so only one
 * click proceeds even if the host double-taps, then (2) read the now-settled tally,
 * work out the winner, and write it together with revealed:true in ONE batch — so no
 * client can ever observe revealed=true before the winner is actually known.
 *
 * A tie is announced rather than resolved here (winnerUids has more than one entry)
 * so everyone sees who tied, and the automatic runoff reopens voting restricted to
 * just those names a few seconds later. Returns false if nothing happened (already
 * revealed, or a reveal is in flight). */
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
    tallySnap.forEach((d) => {
      // A tally doc for someone no longer on the roster — removed between picking up
      // votes and this reveal — must not be eligible to win. Without this guard,
      // that leftover count could still be the highest one here, and computeWinners
      // would hand back a uid with no matching profile: "Unknown" on the results
      // page, and in the reveal ceremony's own wheel popup, since both read the same
      // winnerUids this writes. The vote itself isn't un-cast (that would need
      // knowing who cast it, which nothing here ever learns) — it just can't win.
      if (d.id in profiles) tally[d.id] = d.data().count || 0;
    });
    Object.keys(profiles).forEach((uid) => {
      if (!(uid in tally)) tally[uid] = 0;
    });

    const { winnerUids, totalVotes } = computeWinners(tally);

    const batch = writeBatch(db);
    batch.set(settingsRef, { revealed: true, revealing: false, winnerUids, totalVotes, runoffUids: null }, { merge: true });
    // The tally itself gets wiped (here or at the next rollover) — this is the only
    // lasting record of who received a vote this week, which is what streak badges
    // are computed from. It records only that they received one, never from whom.
    const weekKey = getWeekKey();
    Object.entries(tally).forEach(([uid, count]) => {
      batch.set(weeklyActivityRef(weekKey, uid), { uid, weekKey, received: count > 0 });
    });
    await batch.commit();
    return true;
  } catch (err) {
    // If the lock was already claimed, an error past that point (a flaky tally read,
    // a batch that failed) must not leave revealing:true stuck — that would silently
    // block every future reveal for this week, with no way back from the UI.
    if (claimedLock) {
      await setDoc(settingsRef, { revealing: false }, { merge: true }).catch(() => {});
    }
    throw err;
  }
}

/** Fires on its own a few seconds after a tie is announced — nobody clicks anything.
 * Reuses the `revealing` flag as a claim lock, the same trick doReveal uses. Clears
 * the tied round's voter markers and tally, then reopens voting with everyone (except
 * the host) free to vote again, but only for one of `tiedUids` — enforced in
 * firestore.rules, not just here. Returns false if the tie was already handled. */
export async function startRunoff(tiedUids: string[]): Promise<boolean> {
  const claimed = await runTransaction(db, async (tx) => {
    const snap = await tx.get(settingsRef);
    const s = snap.data();
    if (!s?.revealed || s.revealing || s.runoffUids || (s.winnerUids?.length ?? 0) <= 1) return false;
    tx.set(settingsRef, { revealing: true }, { merge: true });
    return true;
  });
  if (!claimed) return false;

  const batch = writeBatch(db);
  const [voters, tallies] = await Promise.all([getDocs(votersCol), getDocs(tallyCol)]);
  voters.forEach((d) => batch.delete(d.ref));
  tallies.forEach((d) => batch.delete(d.ref));
  batch.set(
    settingsRef,
    { revealed: false, revealing: false, winnerUids: [], totalVotes: 0, runoffUids: tiedUids, votingOpen: true },
    { merge: true },
  );
  await batch.commit();
  return true;
}

/** Escape hatch for a `revealing:true` lock that's stuck — e.g. the host's tab closed
 * between the lock transaction committing and the rest of doReveal running. The
 * normal cleanup only fires from inside doReveal's own catch block, so a lock stuck
 * this way has no automatic recovery. */
export function forceUnlockReveal() {
  return setDoc(settingsRef, { revealing: false }, { merge: true });
}

export function startVoting() {
  return setDoc(settingsRef, { votingOpen: true }, { merge: true });
}

export function endVoting() {
  return setDoc(settingsRef, { votingOpen: false }, { merge: true });
}

/** Marks the current week as intentionally skipped (holiday, etc.) so the vote screen
 * shows "no vote this week" instead of the ambiguous "hasn't opened yet", which reads
 * as "the host forgot". Cleared automatically on the next rollover. */
export function pauseWeek() {
  return setDoc(settingsRef, { weekPaused: true, votingOpen: false }, { merge: true });
}

export function resumeWeek() {
  return setDoc(settingsRef, { weekPaused: false }, { merge: true });
}

/** Nobody clicks a button for this — the moment the voting week changes (Friday, per
 * getWeekKey's Thursday-to-Friday boundary), the HOST's client silently clears the
 * previous week's markers and opens a fresh one. It has to be the host's: wiping
 * sotw_voters and sotw_tally is host-only in firestore.rules, so the same call from
 * anyone else's browser is denied. Voting still starts back up without the host
 * pressing anything, so it's reliably open first thing Friday. Also clears any runoff
 * still in progress — if a tie never finished resolving before the week rolled over,
 * the new week just starts clean. */
export async function rollWeek(newWeekKey: string) {
  const batch = writeBatch(db);
  const [voters, tallies] = await Promise.all([getDocs(votersCol), getDocs(tallyCol)]);
  voters.forEach((d) => batch.delete(d.ref));
  tallies.forEach((d) => batch.delete(d.ref));
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
      weekPaused: false,
    },
    { merge: true },
  );
  await batch.commit();
  clearLocalPick(newWeekKey);
}
