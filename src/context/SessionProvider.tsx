import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { auth, claimsCol, profilesCol, settingsRef, statStatusCol, tallyCol, votersCol } from '@/lib/firebase';
import { DEFAULT_SETTINGS, isHostProfile } from '@/types/firestore';
import type { Claim, Profile, Settings, StatDeclaration, Voter } from '@/types/firestore';
import { getWeekKey } from '@/lib/week';
import { RUNOFF_ANNOUNCE_MS } from '@/lib/constants';
import { clearAllLocalPicks, getLocalPick } from '@/lib/localPick';
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
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [authEpoch, setAuthEpoch] = useState(0);

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

  const [tally, setTally] = useState<Record<string, number>>({});
  const [loadedTally, setLoadedTally] = useState(false);

  const [loadErrorMsg, setLoadErrorMsg] = useState<string | null>(null);
  const onErr = handleErr(setLoadErrorMsg);

  const rollingWeek = useRef(false);
  const startingRunoff = useRef(false);

  // Anonymous sign-in, kicked off once on load. Nobody sees this: there's no screen
  // and nothing to type. It exists only so each browser has a stable uid the security
  // rules can check, which is what makes "this name is taken" enforceable rather than
  // cosmetic. Firebase persists the same anonymous uid across reloads, so a claim
  // survives closing the tab.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthUid(user.uid);
        setAuthResolved(true);
        setAuthEpoch((e) => e + 1);
        return;
      }
      signInAnonymously(auth).catch((err) => {
        console.warn('Anonymous sign-in failed:', err instanceof Error ? err.message : err);
        setLoadErrorMsg(
          "Couldn't start a session on this device. Check your connection and reload — if it persists, anonymous sign-in may need enabling in Firebase.",
        );
        setAuthResolved(true);
      });
    });
    return unsub;
  }, []);

  // The four collections every client watches. All are small and all are needed to
  // render the very first screen (the picker needs profiles + claims; everything
  // after needs settings + statuses), so there's nothing gained by staggering them.
  useEffect(() => {
    if (!authUid) return;
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
  }, [authUid]);

  // Which roster name this browser holds, derived from the claims themselves rather
  // than from anything stored locally — so clearing site data or switching browsers
  // resolves correctly on its own, and two tabs can never disagree about who you are.
  const myUid = useMemo(() => {
    if (!authUid) return null;
    const mine = Object.entries(claims).find(([, c]) => c.authUid === authUid);
    return mine ? mine[0] : null;
  }, [claims, authUid]);

  const me = myUid ? profiles[myUid] ?? null : null;
  const isHost = isHostProfile(me);

  // Mirrors this browser's stored pick into React state so the vote grid re-renders
  // the moment it changes. localStorage is the source of truth (the server has no
  // copy — that's the point), but reading it during render wouldn't re-run when it's
  // written, leaving the "Voted" tick on the wrong card until something else nudged a
  // render. Re-reads whenever the week changes, so a rollover or runoff starts clean.
  const [myPick, setMyPick] = useState<string | null>(() => getLocalPick(settings.currentWeek));

  useEffect(() => {
    setMyPick(getLocalPick(settings.currentWeek));
  }, [settings.currentWeek, myUid]);

  // Only the host ever subscribes to the per-candidate counts, and only once voting
  // has closed. Subscribing any earlier isn't merely unnecessary, it's denied:
  // firestore.rules gates the read on voting being shut precisely so nobody can watch
  // the live count move and infer who just voted. Attempting it anyway would surface
  // a permission error to the host as a spurious "couldn't load".
  useEffect(() => {
    if (!loadedSettings || !loadedClaims) return;
    if (!isHost || settings.votingOpen) {
      setTally({});
      setLoadedTally(false);
      return;
    }
    setLoadedTally(false);
    const unsub = onSnapshot(
      tallyCol,
      (snap) => {
        const t: Record<string, number> = {};
        snap.forEach((d) => (t[d.id] = d.data().count || 0));
        setTally(t);
        setLoadedTally(true);
      },
      onErr,
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedSettings, loadedClaims, isHost, settings.votingOpen]);

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

  const claimName = useCallback(
    async (profileUid: string) => {
      if (!authUid) return;
      // A name change shouldn't inherit the last person's vote state on a shared device.
      clearAllLocalPicks();
      setMyPick(null);
      await claimsService.claimName(profileUid, authUid);
    },
    [authUid],
  );

  const releaseName = useCallback(async () => {
    if (!myUid) return;
    clearAllLocalPicks();
    setMyPick(null);
    await claimsService.releaseName(myUid, isHost);
  }, [myUid, isHost]);

  const value: SessionState = {
    authUid,
    authResolving: !authResolved,
    authEpoch,
    profiles,
    claims,
    settings,
    voters,
    statStatuses,
    tally,
    loadedProfiles,
    loadedClaims,
    loadedSettings,
    loadedVoters,
    loadedStatStatuses,
    loadedTally,
    loadErrorMsg,
    myUid,
    me,
    myPick,
    setMyPick,
    isHost,
    claimName,
    releaseName,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
