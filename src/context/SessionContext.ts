import { createContext } from 'react';
import type { PayoutRequest, Profile, Settings } from '@/types/firestore';
import type { User } from 'firebase/auth';

export interface PayoutRequestWithId extends PayoutRequest {
  id: string;
}

export interface SessionState {
  user: User | null;
  /** True until the first onAuthStateChanged callback has fired. While true, we
   * genuinely don't know yet whether anyone is logged in — render a neutral loading
   * state, never the logged-out gate (a returning user would otherwise flash it). */
  authResolving: boolean;
  /** Bumped on every onAuthStateChanged callback (including a same-user re-login) —
   * use as a reset signal for anything that must not carry state across sessions,
   * like the reveal-ceremony replay guard. */
  authEpoch: number;
  /** Re-reads the current user's Auth record from the server (e.g. after clicking an
   * email verification link) and forces a re-render so `user.emailVerified` reflects it. */
  refreshUser: () => Promise<void>;
  profiles: Record<string, Profile>;
  settings: Settings;
  myVote: string | null;
  myBalance: number;
  tally: Record<string, number>;
  balances: Record<string, number>;
  payoutQueue: PayoutRequestWithId[];
  myPayout: PayoutRequestWithId | null;
  loadedProfiles: boolean;
  loadedSettings: boolean;
  loadedMyVote: boolean;
  loadedMyBalance: boolean;
  loadedTally: boolean;
  loadedBalances: boolean;
  loadErrorMsg: string | null;
  me: Profile | null;
  isAdmin: boolean;
  canManagePayouts: boolean;
}

export const SessionContext = createContext<SessionState | null>(null);
