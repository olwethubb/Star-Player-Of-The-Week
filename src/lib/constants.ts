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
