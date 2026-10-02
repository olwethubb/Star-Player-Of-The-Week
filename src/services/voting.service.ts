import { doc, getDocs, increment, runTransaction, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import {
  db,
  profilesCol,
  settingsRef,
  statStatusCol,
  tallyCol,
  tallyRef,
  voterRef,
  votersCol,
  weeklyActivityRef,
} from '@/lib/firebase';
import { computeWinners } from '@/lib/winners';
import { countableTally } from '@/lib/roundRules';
import { getWeekKey } from '@/lib/week';
import { setLocalPick } from '@/lib/localPick';
import type { Profile, StatDeclaration } from '@/types/firestore';

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
  round: number,
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
  setLocalPick(weekKey, round, forUid);
}

/** Takes back the vote THIS device cast — the -1 mirror of castVote — when its person
 * goes Home. One vote per device: going home clears the vote you gave, so a phone
 * can't be handed round to stack votes. Only ever touches the one count this person
 * added (`pickedUid`, which only this device knows) and their own "I voted" marker;
 * votes other people gave THEM live on other candidates' counts and are never
 * touched. Only valid while voting is open — firestore.rules rejects any count change
 * otherwise. */
export async function retractVote(myUid: string, pickedUid: string) {
  const batch = writeBatch(db);
  batch.set(doc(tallyCol, pickedUid), { count: increment(-1) }, { merge: true });
  batch.delete(voterRef(myUid));
  await batch.commit();
}

/** Reveal happens in two steps: (1) atomically claim a "revealing" lock — and close
 * voting in that same write, so nobody's vote can land after the winner starts being
 * computed — so only one click proceeds even if two of KG/Steph/OB tap it at once,
 * then (2) read the now-settled tally, work out the winner, and write it together
 * with revealed:true in ONE batch — so no client can ever observe revealed=true
 * before the winner is actually known.
 *
 * There's no separate "close voting" step any more: this click does both, in one
 * action, only ever from an explicit "Reveal Winner" tap — never automatically. See
 * SessionControls. It's on whoever clicks it to have actually checked everyone's
 * voted (by asking around the office) — nothing here tracks that.
 *
 * A tie is never resolved down to one name — winnerUids can carry as many uids as
 * are tied for the top count, and every one of them is revealed together as a
 * co-winner (see the wheel's break effect and joinNames in lib/winners.ts). Returns
 * false if nothing happened (already revealed, or a reveal is in flight). */
export async function doReveal(profiles: Record<string, Profile>): Promise<boolean> {
  let claimedLock = false;
  try {
    let currentWeek: string | null = null;
    const claimed = await runTransaction(db, async (tx) => {
      const snap = await tx.get(settingsRef);
      const s = snap.data();
      if (s?.revealed || s?.revealing) return false;
      currentWeek = s?.currentWeek ?? null;
      tx.set(settingsRef, { revealing: true, votingOpen: false }, { merge: true });
      return true;
    });
    claimedLock = claimed;
    if (!claimed) return false;

    const [tallySnap, voters, statuses] = await Promise.all([
      getDocs(tallyCol),
      getDocs(votersCol),
      getDocs(statStatusCol),
    ]);
    // Switching to Down takes away the votes you'd received — they stay on your count
    // until here (nothing mid-round deletes them, so no voter's device is ever left
    // pointing at a count that's gone), and countableTally simply zeroes them. Going
    // Home or an expired sign-in does NOT: votes other people gave you still count.
    const rawTally: Record<string, number> = {};
    tallySnap.forEach((d) => {
      rawTally[d.id] = d.data().count || 0;
    });
    const statusMap: Record<string, StatDeclaration> = {};
    statuses.forEach((d) => {
      statusMap[d.id] = d.data();
    });
    const tally = countableTally(rawTally, profiles, statusMap, currentWeek);

    const { winnerUids, totalVotes } = computeWinners(tally);

    const batch = writeBatch(db);
    // The result lives here, in settings — the only thing the results page reads —
    // so everything below can be wiped in this same write without touching it.
    batch.set(settingsRef, { revealed: true, revealing: false, winnerUids, totalVotes }, { merge: true });
    // The one lasting record of who received a vote this week, which is what streak
    // badges are computed from. It records only that they received one, never from
    // whom — and deliberately survives the reset below.
    const weekKey = getWeekKey();
    Object.entries(tally).forEach(([uid, count]) => {
      batch.set(weeklyActivityRef(weekKey, uid), { uid, weekKey, received: count > 0 });
    });
    // Everything back to zero the moment the winner's known: every count, every "I
    // voted" marker, and everyone's stats-up/down choice, so the next round starts
    // completely clean and nobody's left marked from this one.
    tallySnap.forEach((d) => batch.delete(d.ref));
    voters.forEach((d) => batch.delete(d.ref));
    statuses.forEach((d) => batch.delete(d.ref));
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

/** Wipes the current round's votes and counts and bumps `round`, so everyone's
 * remembered pick is invalidated alongside the counts it referred to — and
 * deliberately leaves voting LOCKED afterward rather than reopening it: a revealer
 * has to follow up with a separate Start Voting tap before anyone can vote again,
 * same as any other fresh start — see startVoting below. Works from either side of
 * a reveal: mid-session, any
 * time nothing's been revealed yet (someone mis-voted, a candidate needs pulling,
 * whatever) — see the Reset Voting button in SessionControls — or after a reveal
 * already happened, from the results page's own "Start a new vote" (without this the
 * results page is otherwise a dead end: the automatic weekly rollover only fires when
 * the calendar week actually changes, so a reveal on a Monday would lock the vote
 * until Friday with no way back).
 *
 * Deletes tally docs by enumerating profiles rather than reading sotw_tally itself,
 * same reasoning as rollWeek: this can fire while voting is still open, and
 * firestore.rules makes sotw_tally unreadable in exactly that state. */
export async function startNewRound(): Promise<boolean> {
  let nextRound = 1;
  const claimed = await runTransaction(db, async (tx) => {
    const snap = await tx.get(settingsRef);
    const s = snap.data();
    if (s?.revealing) return false;
    nextRound = (s?.round ?? 0) + 1;
    tx.set(settingsRef, { revealing: true }, { merge: true });
    return true;
  });
  if (!claimed) return false;

  const batch = writeBatch(db);
  const [voters, profiles] = await Promise.all([getDocs(votersCol), getDocs(profilesCol)]);
  voters.forEach((d) => batch.delete(d.ref));
  profiles.forEach((d) => batch.delete(tallyRef(d.id)));
  batch.set(
    settingsRef,
    {
      revealed: false,
      revealing: false,
      winnerUids: [],
      totalVotes: 0,
      votingOpen: false,
      round: nextRound,
    },
    { merge: true },
  );
  await batch.commit();
  return true;
}

/** The deliberate "we're voting now" moment a revealer has to supply: nothing else in
 * the app ever flips `votingOpen` from false to true on its own (see rollWeek and
 * startNewRound, which both leave it locked) — see the Start Voting button in
 * SessionControls. Until this fires, everyone signed in — revealer included — sees a
 * locked "voting hasn't started" screen instead of the vote grid. */
export function startVoting() {
  return setDoc(settingsRef, { votingOpen: true }, { merge: true });
}

/** Escape hatch for a `revealing:true` lock that's stuck — e.g. the host's tab closed
 * between the lock transaction committing and the rest of doReveal running. The
 * normal cleanup only fires from inside doReveal's own catch block, so a lock stuck
 * this way has no automatic recovery. */
export function forceUnlockReveal() {
  return setDoc(settingsRef, { revealing: false }, { merge: true });
}

/** Nobody clicks a button for this — the moment the voting week changes (Friday, per
 * getWeekKey's Thursday-to-Friday boundary), a revealer's client silently clears the
 * previous week's markers and advances to the new week key. Voting itself still opens
 * LOCKED (`votingOpen: false`) — the new week starting doesn't skip a revealer
 * tapping Start Voting; the two are separate actions on purpose, so nobody's signed-in
 * but voting on a week nobody's actually opened yet, and the vote screen shows
 * "voting hasn't started" until one of KG/Steph/OB deliberately opens it — see
 * startVoting below. Gated on canReveal purely so it's a small trusted set doing it
 * rather than every open tab racing — firestore.rules permits these deletes from
 * anyone (there's no identity to gate them on), so this is a coordination choice, not
 * a permission boundary.
 *
 * Deletes tally docs by profile uid rather than by reading sotw_tally itself, unlike
 * every other wipe in this file — this is the one call that can fire while voting is
 * still open (nobody revealed before the week turned over), and firestore.rules makes
 * sotw_tally unreadable in exactly that state. Deleting a tally doc that was never
 * created is a harmless no-op, so enumerating every known profile instead sidesteps
 * the read entirely. */
export async function rollWeek(newWeekKey: string) {
  const batch = writeBatch(db);
  const [voters, profiles] = await Promise.all([getDocs(votersCol), getDocs(profilesCol)]);
  voters.forEach((d) => batch.delete(d.ref));
  profiles.forEach((d) => batch.delete(tallyRef(d.id)));
  batch.set(
    settingsRef,
    {
      revealed: false,
      revealing: false,
      winnerUids: [],
      totalVotes: 0,
      votingOpen: false,
      currentWeek: newWeekKey,
      // Safe to reset rather than increment: local picks are keyed by week AND round,
      // so the changing week key already invalidates every remembered pick on its own.
      round: 0,
    },
    { merge: true },
  );
  await batch.commit();
}
