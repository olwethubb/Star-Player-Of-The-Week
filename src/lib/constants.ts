export const REVEAL_SPIN_MS = 5000; // how long the wheel spins for once a reveal starts
// Under prefers-reduced-motion, the wheel settles directly on the winner with a short
// crossfade instead of a full spin — this is that crossfade's duration, used both for
// the wheel's own CSS transition and for scheduling when the "landed" phase begins.
export const REVEAL_SPIN_MS_REDUCED = 400;
// How long the landed wheel + confetti + winner popup stay up — the actual
// celebration moment, capped at 8s per the "shouldn't be more than 8 seconds" call.
export const REVEAL_POPUP_HOLD_MS = 8000;

// How long a tie's names stay on screen before the automatic runoff reopens voting.
// The reveal ceremony (spin + hold) plays first regardless of what settings do
// underneath — this timer only starts counting once `revealed` flips true, so it
// must clear that whole ceremony before firing, or the runoff would start while
// people are still watching the wheel spin and nobody would ever actually see the
// tied names land on the real results screen. ~6s of real reading time on top.
export const RUNOFF_ANNOUNCE_MS = REVEAL_SPIN_MS + REVEAL_POPUP_HOLD_MS + 6000;
