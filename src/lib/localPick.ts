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

const PICK_PREFIX = 'sotw_pick_';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // Private mode / storage disabled — the app still works, it just can't show
    // your existing pick back to you or let you change it.
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore — a vote that can't be remembered locally is still cast.
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore.
  }
}

/** Scoped per week so last week's pick never shows up as this week's, and so a
 * runoff (which clears everyone's vote server-side) starts visually clean too. */
function pickKey(weekKey: string): string {
  return `${PICK_PREFIX}${weekKey}`;
}

export function getLocalPick(weekKey: string | null): string | null {
  if (!weekKey) return null;
  return safeGet(pickKey(weekKey));
}

export function setLocalPick(weekKey: string | null, votedForUid: string): void {
  if (!weekKey) return;
  safeSet(pickKey(weekKey), votedForUid);
}

export function clearLocalPick(weekKey: string | null): void {
  if (!weekKey) return;
  safeRemove(pickKey(weekKey));
}

/** Drops every remembered pick, whatever week it was for — used when handing the
 * device to someone else, so the next person doesn't inherit your vote state. */
export function clearAllLocalPicks(): void {
  try {
    const stale = Object.keys(localStorage).filter((k) => k.startsWith(PICK_PREFIX));
    stale.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Ignore.
  }
}
