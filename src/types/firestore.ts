import type { Timestamp } from 'firebase/firestore';

export type Role = 'owner' | 'admin' | 'member';

export interface Profile {
  name: string;
  email: string;
  role: Role;
  selfSignup?: boolean;
  /** A small compressed data URI (see lib/avatar.ts) — deliberately not a Storage
   * file, so avatars work without standing up Cloud Storage for the project. */
  avatarUrl?: string;
}

export interface Balance {
  balance: number;
}

export interface MyVote {
  votedForUid: string;
  ts: Timestamp | null;
}

export interface Tally {
  count: number;
}

export interface Settings {
  revealed: boolean;
  revealing: boolean;
  winnerUids: string[];
  totalVotes: number;
  /** Non-null while a runoff round is the active vote: everyone (except admins) can
   * still vote, but only for one of these uids — the ones who tied last round. Null
   * outside of a runoff, including during a normal week's voting. */
  runoffUids: string[] | null;
  financeUid: string | null;
  votingOpen: boolean;
  currentWeek: string | null;
  /** An admin marked this week as intentionally skipped (holiday, etc.) — shown
   * instead of the ambiguous "voting hasn't opened yet", which reads as "the admin
   * forgot" rather than "nothing was scheduled this week". Cleared on rollover. */
  weekPaused: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  revealed: false,
  revealing: false,
  winnerUids: [],
  totalVotes: 0,
  runoffUids: null,
  financeUid: null,
  votingOpen: false,
  currentWeek: null,
  weekPaused: false,
};

export type PayoutStatus = 'pending' | 'paid' | 'rejected' | 'cancelled';

export interface PayoutRequest {
  uid: string;
  name: string;
  amount: number;
  status: PayoutStatus;
  requestedAt: Timestamp | null;
  resolvedAt: Timestamp | null;
  resolvedBy: string | null;
}

export interface Payout {
  uid: string;
  name: string;
  amount: number;
  week: string;
  ts: Timestamp | null;
}

/** Append-only audit trail for manual balance edits from the team panel — so
 * "why is this balance what it is" is answerable from the app, not by asking
 * whoever built it to go look in Firestore. Payouts/bonuses already have their
 * own log (Payout above); this covers the other way a balance changes. */
export interface BalanceAdjustment {
  uid: string;
  from: number;
  to: number;
  adjustedBy: string;
  ts: Timestamp | null;
}

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

export function isAdmin(profile: Profile | null | undefined): boolean {
  return !!profile && (profile.role === 'owner' || profile.role === 'admin');
}

export function isFinanceUid(settings: Settings | null, uid: string | null | undefined): boolean {
  return !!uid && !!settings && settings.financeUid === uid;
}

export function canManagePayouts(
  profile: Profile | null | undefined,
  uid: string | null | undefined,
  settings: Settings | null,
): boolean {
  return isAdmin(profile) || isFinanceUid(settings, uid);
}
