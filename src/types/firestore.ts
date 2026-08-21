import type { Timestamp } from 'firebase/firestore';

export type Role = 'owner' | 'admin' | 'member';

export interface Profile {
  name: string;
  email: string;
  role: Role;
  selfSignup?: boolean;
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
