export const BONUS_AMOUNT = 300; // Blacfox Dollars awarded to the weekly winner
export const SIGNUP_EMAIL_DOMAIN = '@blacfox.com';

export const REVEAL_COUNTDOWN_START = 7; // counts down "7… 6… 5… …1" before the wheel spins
export const REVEAL_COUNTDOWN_MS = REVEAL_COUNTDOWN_START * 1000; // 1s per number
export const REVEAL_SPIN_MS = 5000; // how long the wheel spins for once the countdown hits zero
// Under prefers-reduced-motion, the wheel settles directly on the winner with a short
// crossfade instead of a full spin — this is that crossfade's duration, used both for
// the wheel's own CSS transition and for scheduling when the "landed" phase begins.
export const REVEAL_SPIN_MS_REDUCED = 400;
export const REVEAL_POPUP_HOLD_MS = 2600; // how long the landed wheel + winner popup stay up

// How long a tie's names stay on screen before the automatic runoff reopens voting.
// The reveal ceremony (countdown + spin + hold, ~14.6s) plays first regardless of
// what settings do underneath — this timer only starts counting once `revealed`
// flips true, so it must clear that whole ceremony before firing, or the runoff
// would start while people are still watching the countdown and nobody would ever
// actually see the tied names land on the real results screen. ~6s of real reading
// time on top of the ceremony.
export const RUNOFF_ANNOUNCE_MS = REVEAL_COUNTDOWN_MS + REVEAL_SPIN_MS + REVEAL_POPUP_HOLD_MS + 6000;
