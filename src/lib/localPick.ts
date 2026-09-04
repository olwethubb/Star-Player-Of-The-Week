// Where your vote actually lives.
//
// The server is told that you voted (sotw_voters) and that someone's count went up
// (sotw_tally), but never the link between the two. That link exists in exactly one
// place: this browser's localStorage. It's what lets the app show "Voted" on the
// right card and lets you change your mind (decrement the old, increment the new)
// without any record of your pick ever leaving the device.
//
// The trade-off is deliberate: clear your browser data and the app forgets who you
// voted for, so the "Voted" tick goes away. Your vote itself still counts — it's in
// the tally — you just can't change it from a browser that no longer remembers it.

const PREFIX = 'sotw_pick_';

/** Scoped to the week AND the round within it.
 *
 * The round half is load-bearing, not cosmetic. A runoff (and the host starting a
 * fresh round) deletes every sotw_tally doc while leaving the week key alone. Keyed
 * by week alone, a browser would keep pointing at a pick whose count no longer
 * exists, and its next vote would try to decrement a deleted doc — which lands as a
 * CREATE with count -1 and is rejected by firestore.rules, breaking voting entirely
 * for anyone who had already voted. Folding the round in means the key changes at the
 * exact moment the counts are wiped, so every browser starts the new round clean. */
function pickKey(weekKey: string, round: number): string {
  return `${PREFIX}${weekKey}#${round}`;
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // Private mode / storage disabled — the app still works, it just can't show
    // your existing pick back to you or let you change it.
    return null;
  }
}

export function getLocalPick(weekKey: string | null, round: number): string | null {
  if (!weekKey) return null;
  return safeGet(pickKey(weekKey, round));
}

/** Writes this round's pick and drops any other remembered pick, so a browser never
 * accumulates one entry per round forever and can never read back a stale one. */
export function setLocalPick(weekKey: string | null, round: number, votedForUid: string): void {
  if (!weekKey) return;
  clearAllLocalPicks();
  try {
    localStorage.setItem(pickKey(weekKey, round), votedForUid);
  } catch {
    // Ignore — a vote that can't be remembered locally is still cast.
  }
}

/** Drops every remembered pick, whatever week or round it was for — used when handing
 * the device to someone else, so the next person doesn't inherit your vote state. */
export function clearAllLocalPicks(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // Ignore.
  }
}
