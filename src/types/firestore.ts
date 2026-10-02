import type { Timestamp } from 'firebase/firestore';

/** A teammate on the roster. Deliberately has no email, no role and no balance —
 * this app does nothing but run the weekly vote, so a name and a face is the whole
 * of what it needs to know about anyone. */
export interface Profile {
  name: string;
  /** A small compressed data URI (see lib/avatar.ts) — deliberately not a Storage
   * file, so avatars work without standing up Cloud Storage for the project. */
  avatarUrl?: string;
}

/** Marks one roster name as taken. There's no sign-in of any kind behind this app any
 * more, so this is a convention the app's own UI respects (first tap wins the create,
 * and the UI greys out anyone already claimed), not something the database can verify
 * belongs to a particular person — see lib/localIdentity.ts for the trade-off.
 *
 * Claiming a name has no expiry on its own — closing a tab doesn't release it, so
 * without something else watching, a name claimed once could sit "taken" forever.
 * `lastSeenAt` is that something else: a heartbeat the claiming browser refreshes
 * every CLAIM_HEARTBEAT_MS while it's actually open (see touchClaim in
 * claims.service.ts), so a claim nobody's refreshed in a while can be told apart
 * from one that's still genuinely in use. `claimedAt` itself never changes once
 * written — see firestore.rules, which allows updating `lastSeenAt` alone and
 * nothing else on this doc. */
export interface Claim {
  claimedAt: Timestamp | null;
  lastSeenAt?: Timestamp | null;
}

export interface Tally {
  count: number;
}

/** Proof that someone has voted this week — and deliberately NOTHING else.
 *
 * There is no field here for who they picked, and no other collection records it
 * either: your own pick is written only to your browser's localStorage. That's what
 * makes "the host sees the numbers but never who voted for who" a property of the
 * data model rather than a promise the UI makes. Even someone reading the raw
 * database can only learn that you voted, never for whom. */
export interface Voter {
  weekKey: string;
  ts: Timestamp | null;
}

export interface Settings {
  revealed: boolean;
  revealing: boolean;
  /** Every uid tied for the most votes — just one most weeks, but a tie is never
   * resolved down to a single name. See computeWinners/joinNames in lib/winners.ts
   * for how arbitrarily many tied names get computed and shown together. */
  winnerUids: string[];
  totalVotes: number;
  votingOpen: boolean;
  currentWeek: string | null;
  /** Bumped every time the tally is wiped WITHIN the same week — a revealer resetting
   * or restarting a round. Local vote picks are keyed by week AND round (see
   * lib/localPick.ts), so bumping this is what invalidates every browser's remembered
   * pick at the same instant the counts it referred to are deleted.
   *
   * Without it, a browser would still think it had voted for someone whose tally doc
   * no longer exists, and its next vote would try to decrement a deleted count — a
   * write firestore.rules rejects outright, silently breaking that person's ability
   * to vote for the rest of the round. Resets to 0 on a real week rollover, where the
   * changing week key already does the invalidating. */
  round: number;
}

export const DEFAULT_SETTINGS: Settings = {
  revealed: false,
  revealing: false,
  winnerUids: [],
  totalVotes: 0,
  votingOpen: false,
  currentWeek: null,
  round: 0,
};

export type StatLevel = 'up' | 'down';

/** Someone's self-declared status for the CURRENT week — one doc per person,
 * overwritten each time they change it. Only 'up' makes them eligible to be voted
 * for this week (see firestore.rules' isUpThisWeek); 'down' just means nobody can
 * vote for them, not that they can't vote themselves. weekKey is what makes an old
 * declaration stop counting once a new week starts, without needing to delete it. */
export interface StatDeclaration {
  weekKey: string;
  status: StatLevel;
}

/** One doc per person per week (id: `${weekKey}_${uid}`), written at reveal time
 * alongside the tally read — the tally itself gets wiped, so this is the only
 * lasting record of who actually received a vote that week. Used for streak
 * badges (received votes 3+ weeks running, whether or not they won). */
export interface WeeklyActivity {
  uid: string;
  weekKey: string;
  received: boolean;
}

/** KG is the CEO, and — separately from anything about revealing — is never a vote
 * candidate: not asked to declare stats, never eligible for a vote, no matter what
 * MainScreen's isEligibleCandidate says about claims/declarations alone. This stays
 * pinned to the name KG specifically, even though the reveal action itself (see
 * REVEALER_NAMES below) is also available to Steph and OB — being able to reveal
 * doesn't make either of them the CEO too. Also the name the app bootstraps the very
 * first profile as (see NamePicker's BootstrapFirstRun). Matched on the roster name
 * rather than a stored flag, same reasoning as ADMIN_NAME below. */
export const HOST_NAME = 'KG';

export function isHostName(name: string | null | undefined): boolean {
  return !!name && name.trim().toLowerCase() === HOST_NAME.toLowerCase();
}

export function isHostProfile(profile: Profile | null | undefined): boolean {
  return isHostName(profile?.name);
}

/** The one other name (besides KG) matched specifically rather than by role — OB is
 * the person actually running this deployment, independent of anything to do with a
 * given week's vote. Its only remaining use is as one of the three REVEALER_NAMES
 * below; it used to also unlock the Team panel on its own, but that's now just
 * "can this browser reveal" like KG and Steph — see canReveal in SessionProvider. */
export const ADMIN_NAME = 'OB';

/** Whoever's claimed one of these three names can reveal the week's winner — and,
 * since that's the only privileged action left in the app, also gets the Team panel.
 * Not a priority order and not exclusive: unlike the single-host design this
 * replaced, any of the three who happen to be claimed at once can each act, and none
 * of them are barred from voting themselves — they declare stats and cast a vote
 * exactly like everyone else. It's on the team to actually check everyone's voted
 * (by asking around the office) before one of them clicks Reveal — nothing here
 * tracks that. Deliberately a separate concept from HOST_NAME/isHostProfile above:
 * this is about who's trusted to close out a week, not about who the CEO is, and it
 * never affects candidacy — see isHostName's doc comment. See isRevealerProfile. */
export const REVEALER_NAMES = [HOST_NAME, 'Steph', ADMIN_NAME];

export function isRevealerName(name: string | null | undefined): boolean {
  const lower = name?.trim().toLowerCase();
  return !!lower && REVEALER_NAMES.some((n) => n.toLowerCase() === lower);
}

export function isRevealerProfile(profile: Profile | null | undefined): boolean {
  return isRevealerName(profile?.name);
}

/** Of the three REVEALER_NAMES, only these two are flagged in the name picker's own
 * list — a small star next to the name, visible to anyone picking who they are,
 * before they've claimed anything. OB's ability to reveal is deliberately NOT
 * advertised there, so nobody glancing at that list can tell OB is also a revealer.
 * This is cosmetic only, scoped to the picker: OB has every bit of REVEALER_NAMES'
 * actual power once claimed (the Reveal Winner button, the Team panel) — nothing
 * elsewhere treats OB any differently from KG or Steph. See NamePicker. */
export const PUBLIC_REVEALER_NAMES = [HOST_NAME, 'Steph'];

export function isPubliclyTaggedRevealer(name: string | null | undefined): boolean {
  const lower = name?.trim().toLowerCase();
  return !!lower && PUBLIC_REVEALER_NAMES.some((n) => n.toLowerCase() === lower);
}
