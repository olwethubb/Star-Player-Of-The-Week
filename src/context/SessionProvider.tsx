import { onSnapshot } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { claimsCol, profilesCol, settingsRef, statStatusCol, votersCol } from '@/lib/firebase';
import { DEFAULT_SETTINGS, isAdminProfile, isHostProfile } from '@/types/firestore';
import type { Claim, Profile, Settings, StatDeclaration, Voter } from '@/types/firestore';
import { getWeekKey } from '@/lib/week';
import { RUNOFF_ANNOUNCE_MS } from '@/lib/constants';
import { clearAllLocalPicks, getLocalPick } from '@/lib/localPick';
import { localIdentity } from '@/lib/localIdentity';
import { rollWeek, startRunoff } from '@/services/voting.service';
import * as claimsService from '@/services/claims.service';
import { SessionContext, type SessionState } from './SessionContext';

function handleErr(setLoadError: (msg: string) => void) {
  return (err: unknown) => {
    console.warn('Firestore error:', err instanceof Error ? err.message : err);
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'permission-denied') {
      setLoadError("Couldn't load the vote. Try reloading the page — if it keeps happening, ask KG to take a look.");
    }
  };
}

/** Turns a snapshot into a plain uid -> data map. Every collection here is small
 * (one doc per teammate), so holding them all in memory is the simple, correct move. */
function toMap<T>(snap: { forEach: (fn: (d: { id: string; data: () => T }) => void) => void }): Record<string, T> {
  const out: Record<string, T> = {};
  snap.forEach((d) => (out[d.id] = d.data()));
  return out;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loadedProfiles, setLoadedProfiles] = useState(false);

  const [claims, setClaims] = useState<Record<string, Claim>>({});
  const [loadedClaims, setLoadedClaims] = useState(false);

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loadedSettings, setLoadedSettings] = useState(false);

  const [voters, setVoters] = useState<Record<string, Voter>>({});
  const [loadedVoters, setLoadedVoters] = useState(false);

  const [statStatuses, setStatStatuses] = useState<Record<string, StatDeclaration>>({});
  const [loadedStatStatuses, setLoadedStatStatuses] = useState(false);

  const [loadErrorMsg, setLoadErrorMsg] = useState<string | null>(null);
  const onErr = handleErr(setLoadErrorMsg);

  // Who this browser is, remembered locally rather than resolved from any kind of
  // sign-in — there isn't one. See lib/localIdentity.ts for what that trades away.
  const [myUid, setMyUid] = useState<string | null>(() => localIdentity.get());

  const rollingWeek = useRef(false);
  const startingRunoff = useRef(false);
  // Shields a name we just claimed from the orphan-check effect below, for the one
  // moment where it would otherwise misfire — see that effect's comment.
  const justClaimedUid = useRef<string | null>(null);

  // The five collections every client watches, all subscribed immediately on mount —
  // there's no identity to wait on any more before reading. All are small and all are
  // needed to render the very first screen (the picker needs profiles + claims;
  // everything after needs settings + statuses), so there's nothing gained by
  // staggering them.
  useEffect(() => {
    const subs = [
      onSnapshot(
        profilesCol,
        (snap) => {
          setProfiles(toMap<Profile>(snap));
          setLoadedProfiles(true);
          setLoadErrorMsg(null);
        },
        onErr,
      ),
      onSnapshot(
        claimsCol,
        (snap) => {
          setClaims(toMap<Claim>(snap));
          setLoadedClaims(true);
        },
        onErr,
      ),
      onSnapshot(
        settingsRef,
        (snap) => {
          setSettings(snap.data() ?? DEFAULT_SETTINGS);
          setLoadedSettings(true);
        },
        onErr,
      ),
      onSnapshot(
        votersCol,
        (snap) => {
          setVoters(toMap<Voter>(snap));
          setLoadedVoters(true);
        },
        onErr,
      ),
      onSnapshot(
        statStatusCol,
        (snap) => {
          setStatStatuses(toMap<StatDeclaration>(snap));
          setLoadedStatStatuses(true);
        },
        onErr,
      ),
    ];
    return () => subs.forEach((unsub) => unsub());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If this browser remembers a name but that claim has since been freed (the host
  // cleared it, or the teammate was removed), fall back to the picker instead of a
  // broken "voting as nobody" state.
  //
  // The justClaimedUid guard exists because of a real race, not a hypothetical one:
  // claimName below sets myUid the instant its Firestore transaction is acknowledged,
  // but a transaction's result doesn't carry the same "applied to the local cache
  // immediately" guarantee a plain write gets — the claimsCol listener that updates
  // `claims` is a separate round trip that can genuinely land a beat later. Without
  // this guard, THIS effect would run in that gap, see `claims[myUid]` still missing,
  // and immediately clear the identity we just successfully claimed — bouncing
  // straight back to the picker having done nothing visible but remove the name from
  // the list. The guard trusts our own just-completed write until the snapshot
  // catches up and confirms it, then gets out of the way so a genuinely freed claim
  // (the host clearing it, mid-session) still bounces us back as intended.
  useEffect(() => {
    if (!loadedClaims || !myUid) return;
    if (claims[myUid]) {
      if (justClaimedUid.current === myUid) justClaimedUid.current = null;
      return;
    }
    if (justClaimedUid.current === myUid) return;
    localIdentity.clear();
    setMyUid(null);
  }, [loadedClaims, claims, myUid]);

  const me = myUid ? profiles[myUid] ?? null : null;
  const isHost = isHostProfile(me);
  const canManageTeam = isHost || isAdminProfile(me);

  // Mirrors this browser's stored pick into React state so the vote grid re-renders
  // the moment it changes. localStorage is the source of truth (the server has no
  // copy — that's the point), but reading it during render wouldn't re-run when it's
  // written, leaving the "Voted" tick on the wrong card until something else nudged a
  // render. Re-reads whenever the week changes, so a rollover or runoff starts clean.
  // Re-reads on `round` as well as the week: a runoff or a fresh round wipes the tally
  // without changing the week key, and bumps round instead — that's the signal this
  // browser's remembered pick no longer refers to anything. See lib/localPick.ts.
  const [myPick, setMyPick] = useState<string | null>(() =>
    getLocalPick(settings.currentWeek, settings.round ?? 0),
  );

  useEffect(() => {
    setMyPick(getLocalPick(settings.currentWeek, settings.round ?? 0));
  }, [settings.currentWeek, settings.round, myUid]);

  // Nobody clicks a button for this — the moment the voting week changes (Friday, per
  // getWeekKey's Thursday-to-Friday boundary), the host's client silently clears last
  // week's votes and opens a fresh one, whether or not anyone revealed the last one.
  useEffect(() => {
    if (!loadedSettings || rollingWeek.current || !isHost) return;
    const key = getWeekKey();
    if (settings.currentWeek === key) return;
    rollingWeek.current = true;
    rollWeek(key)
      .catch((err) => console.warn('Automatic week rollover failed:', err instanceof Error ? err.message : err))
      .finally(() => {
        rollingWeek.current = false;
      });
  }, [loadedSettings, isHost, settings.currentWeek]);

  // Nor for this — the moment the host's client sees a tie was just announced
  // (revealed, more than one winner, no runoff yet), it waits long enough for the tie
  // to actually be readable on screen, then reopens voting restricted to those names.
  // startRunoff's own transaction is the real guard; this ref just stops one client
  // firing the timer twice.
  useEffect(() => {
    if (!loadedSettings || startingRunoff.current || !isHost) return;
    if (!(settings.revealed && settings.winnerUids.length > 1 && !settings.runoffUids)) return;
    startingRunoff.current = true;
    const timer = setTimeout(() => {
      startRunoff(settings.winnerUids)
        .catch((err) => console.warn('Automatic runoff failed to start:', err instanceof Error ? err.message : err))
        .finally(() => {
          startingRunoff.current = false;
        });
    }, RUNOFF_ANNOUNCE_MS);
    return () => {
      clearTimeout(timer);
      startingRunoff.current = false;
    };
  }, [loadedSettings, isHost, settings.revealed, settings.winnerUids, settings.runoffUids]);

  const claimName = useCallback(async (profileUid: string) => {
    // A name change shouldn't inherit the last person's vote state on a shared device.
    clearAllLocalPicks();
    setMyPick(null);
    await claimsService.claimName(profileUid);
    // Set BEFORE setMyUid, so it's already in place when that state change runs the
    // orphan-check effect above — see its comment for why this order matters.
    justClaimedUid.current = profileUid;
    localIdentity.set(profileUid);
    setMyUid(profileUid);
  }, []);

  const releaseName = useCallback(async () => {
    if (!myUid) return;
    clearAllLocalPicks();
    setMyPick(null);
    await claimsService.releaseName(myUid);
    if (justClaimedUid.current === myUid) justClaimedUid.current = null;
    localIdentity.clear();
    setMyUid(null);
  }, [myUid]);

  const value: SessionState = {
    profiles,
    claims,
    settings,
    voters,
    statStatuses,
    loadedProfiles,
    loadedClaims,
    loadedSettings,
    loadedVoters,
    loadedStatStatuses,
    loadErrorMsg,
    myUid,
    me,
    myPick,
    setMyPick,
    isHost,
    canManageTeam,
    claimName,
    releaseName,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
