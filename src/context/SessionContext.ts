import { createContext } from 'react';
import type { Claim, Profile, Settings, StatDeclaration, Voter } from '@/types/firestore';

export interface SessionState {
  profiles: Record<string, Profile>;
  /** uid -> who's taken that name. The picker greys out anyone already claimed, and
   * this is also how the app works out which profile THIS browser is (by matching
   * myUid, remembered locally — see lib/localIdentity.ts). */
  claims: Record<string, Claim>;
  settings: Settings;
  /** uid -> marker that they've voted this week. Records only that they voted, never
   * for whom — see types/firestore.ts Voter. */
  voters: Record<string, Voter>;
  statStatuses: Record<string, StatDeclaration>;

  loadedProfiles: boolean;
  loadedClaims: boolean;
  loadedSettings: boolean;
  loadedVoters: boolean;
  loadedStatStatuses: boolean;
  loadErrorMsg: string | null;

  /** The uid of the roster profile this browser has claimed, or null if none yet.
   * Remembered in this browser's own localStorage — there's no account behind it. */
  myUid: string | null;
  me: Profile | null;
  /** Who I voted for this week, read back from this browser's own storage — the
   * server has no idea. Null if I haven't voted, or if I voted from another device. */
  myPick: string | null;
  /** Called after a vote lands so the grid re-renders against the new pick.
   * lib/localPick.ts is what actually persists it; this just mirrors it into state. */
  setMyPick: (uid: string | null) => void;
  /** True when this browser has claimed one of the three names in REVEALER_NAMES —
   * KG, Steph, or OB (types/firestore.ts). Shows the Reveal Winner button, grants the
   * Team panel, and is exempt from the auto sign-out after a reveal. Unlike the
   * single-host design this replaced, a revealer votes exactly like anyone else —
   * this never gates candidacy or the ability to cast a vote, only the reveal action
   * itself and roster management. (Separately, permanently, regardless of who's
   * currently a revealer, KG specifically is never a CANDIDATE either, since KG's the
   * CEO — see isHostProfile.) Nothing stops a browser from lying about this — see
   * lib/localIdentity.ts. */
  canReveal: boolean;

  /** Take a name. Rejects if someone else already holds it. */
  claimName: (profileUid: string) => Promise<void>;
  /** Hand the name back so the next person can use this device. */
  releaseName: () => Promise<void>;
}

export const SessionContext = createContext<SessionState | null>(null);
