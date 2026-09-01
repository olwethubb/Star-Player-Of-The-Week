// Where "who am I" lives now that there's no sign-in of any kind, visible or not:
// this browser's own localStorage, and nowhere else.
//
// That's a real trade-off, not a simplification for its own sake — without any
// server-checkable identity, nothing stops a second browser from also deciding it's
// "OB". The claim doc in Firestore is still create-only (first write wins), which
// stops two browsers from both winning the SAME tap, but nothing verifies that the
// browser tapping a name is the person it belongs to. That enforcement was the one
// and only job anonymous auth was doing; dropping it was a deliberate call once the
// app stopped holding anything worth protecting that way.

const KEY = 'sotw_myUid';

function safeGet(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function safeSet(uid: string): void {
  try {
    localStorage.setItem(KEY, uid);
  } catch {
    // Ignore — worst case, this browser re-asks "who are you" next load.
  }
}

function safeClear(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Ignore.
  }
}

export const localIdentity = { get: safeGet, set: safeSet, clear: safeClear };
