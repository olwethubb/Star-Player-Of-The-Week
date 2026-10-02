// How long the wheel spins for once a reveal starts, until it lands on the winner.
// Timed for KG to say the announcement line ("And the star player of this week is
// none other than...") over the spin, landing right as they finish — 12s at a
// deliberately slow, dramatic pace.
export const REVEAL_SPIN_MS = 12000;
// Under prefers-reduced-motion, the wheel settles directly on the winner with a short
// crossfade instead of a full spin — this is that crossfade's duration, used both for
// the wheel's own CSS transition and for scheduling when the "landed" phase begins.
export const REVEAL_SPIN_MS_REDUCED = 400;
// How long the landed wheel + confetti + winner popup stay up — the actual
// celebration moment, capped at 8s per the "shouldn't be more than 8 seconds" call.
export const REVEAL_POPUP_HOLD_MS = 8000;
// On a tie, how long after landing the wheel spends visibly cracking apart before
// the tied names and confetti pop in — so it reads as "spun, broke, then revealed"
// rather than the popup landing on top of the break. Matches the wheel-break-half
// transition timing in globals.css. Comes out of REVEAL_POPUP_HOLD_MS, not on top.
export const REVEAL_TIE_BREAK_MS = 700;

// How long a non-revealer viewer gets to read the results page (the reveal ceremony
// itself already ran before this — see App.tsx) before they're automatically signed
// out back to the name picker. A revealer (KG, Steph, or OB) is exempt and stays put,
// since they still need the session controls below the result. Everyone else
// re-picks their name next time they want to vote — see the effect in
// ResultsPage.tsx.
export const RESULTS_AUTO_SIGNOUT_MS = 10000;

// How often an open, claimed browser refreshes its claim's `lastSeenAt` — see
// touchClaim in claims.service.ts. Short enough that the turnout count catches up
// quickly once someone's actually gone.
export const CLAIM_HEARTBEAT_MS = 30000;
// How long with no heartbeat before a claim is considered abandoned and swept —
// see releaseStaleClaims in claims.service.ts, run from every open tab in
// SessionProvider.tsx. Long enough that someone who's just stepped away, or whose
// tab got backgrounded and throttled, doesn't get bumped off mid-session; short
// enough that a name left over from a closed tab doesn't sit "taken" for days.
export const CLAIM_STALE_AFTER_MS = 15 * 60 * 1000;
