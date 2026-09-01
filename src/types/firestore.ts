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
 * belongs to a particular person — see lib/localIdentity.ts for the trade-off. */
export interface Claim {
  claimedAt: Timestamp | null;
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
  winnerUids: string[];
  totalVotes: number;
  /** Non-null while a runoff round is the active vote: everyone (except the host)
   * can still vote, but only for one of these uids — the ones who tied last round.
   * Null outside of a runoff, including during a normal week's voting. */
  runoffUids: string[] | null;
  votingOpen: boolean;
  currentWeek: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  revealed: false,
  revealing: false,
  winnerUids: [],
  totalVotes: 0,
  runoffUids: null,
  votingOpen: false,
  currentWeek: null,
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

/** Whoever claims this name runs the session: they don't vote, they open and close
 * voting, and they're the only one who sees the per-person counts (so they can
 * commentate on who's leading, or call a tie). It's matched on the roster name
 * rather than a stored flag because that's the whole rule — "whoever picks KG
 * reveals" — and it keeps the roster free of admin plumbing. */
export const HOST_NAME = 'KG';

export function isHostName(name: string | null | undefined): boolean {
  return !!name && name.trim().toLowerCase() === HOST_NAME.toLowerCase();
}

export function isHostProfile(profile: Profile | null | undefined): boolean {
  return isHostName(profile?.name);
}
