import { createContext } from 'react';
import type { Claim, Profile, Settings, StatDeclaration, Voter } from '@/types/firestore';

export interface SessionState {
  /** The anonymous Firebase uid for THIS browser. Never shown to anyone; it exists
   * so the security rules can tell one device from another, which is what makes a
   * name claim enforceable. Null until anonymous sign-in resolves. */
  authUid: string | null;
  /** True until anonymous sign-in has resolved. While true we genuinely don't know
   * yet whether this browser already holds a name — render a neutral loading state,
   * never the picker (someone who's already chosen would otherwise flash it). */
  authResolving: boolean;
  /** Bumped whenever the anonymous identity changes — a reset signal for anything
   * that must not carry state across sessions, like the reveal-ceremony replay guard. */
  authEpoch: number;

  profiles: Record<string, Profile>;
  /** uid -> who holds that name. The picker greys out anyone already taken, and this
   * is also how the app works out which profile THIS browser is. */
  claims: Record<string, Claim>;
  settings: Settings;
  /** uid -> marker that they've voted this week. Records only that they voted, never
   * for whom — see types/firestore.ts Voter. */
  voters: Record<string, Voter>;
  statStatuses: Record<string, StatDeclaration>;
  /** Per-candidate counts. Populated ONLY for the host, and only once voting has
   * closed — firestore.rules refuses the read otherwise. Empty for everyone else. */
  tally: Record<string, number>;

  loadedProfiles: boolean;
  loadedClaims: boolean;
  loadedSettings: boolean;
  loadedVoters: boolean;
  loadedStatStatuses: boolean;
  loadedTally: boolean;
  loadErrorMsg: string | null;

  /** The uid of the roster profile this browser has claimed, or null if none yet. */
  myUid: string | null;
  me: Profile | null;
  /** Who I voted for this week, read back from this browser's own storage — the
   * server has no idea. Null if I haven't voted, or if I voted from another device. */
  myPick: string | null;
  /** Called after a vote lands so the grid re-renders against the new pick.
   * lib/localPick.ts is what actually persists it; this just mirrors it into state. */
  setMyPick: (uid: string | null) => void;
  /** True when this browser holds the claim on the profile named KG. The host runs
   * the session: they don't vote, they open and close it, and they alone see the
   * per-person counts. */
  isHost: boolean;

  /** Take a name. Rejects if someone else already holds it. */
  claimName: (profileUid: string) => Promise<void>;
  /** Hand the name back so the next person can use this device. */
  releaseName: () => Promise<void>;
}

export const SessionContext = createContext<SessionState | null>(null);
