import { onSnapshot } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { claimsCol, profilesCol, settingsRef, statStatusCol, votersCol } from '@/lib/firebase';
import { DEFAULT_SETTINGS, isRevealerProfile } from '@/types/firestore';
import type { Claim, Profile, Settings, StatDeclaration, Voter } from '@/types/firestore';
import { getWeekKey } from '@/lib/week';
import { CLAIM_HEARTBEAT_MS } from '@/lib/constants';
import { clearAllLocalPicks, getLocalPick } from '@/lib/localPick';
import { localIdentity } from '@/lib/localIdentity';
import * as votingService from '@/services/voting.service';
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
  // Shields a name we just claimed from the orphan-check effect below, for the one
  // moment where it would otherwise misfire — see that effect's comment.
  const justClaimedUid = useRef<string | null>(null);
  // Lets the stale-claim sweep below read the latest claims from inside a long-lived
  // interval without restarting that interval every time any claim changes — see
  // that effect's own comment.
  const sweepInputsRef = useRef<{
    claims: Record<string, Claim>;
    statuses: Record<string, StatDeclaration>;
    currentWeek: string | null;
  }>({ claims: {}, statuses: {}, currentWeek: null });

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

  useEffect(() => {
    sweepInputsRef.current = { claims, statuses: statStatuses, currentWeek: settings.currentWeek };
  }, [claims, statStatuses, settings.currentWeek]);

  // The heartbeat: as long as this browser's tab is actually open with a claimed
  // name, it proves that every CLAIM_HEARTBEAT_MS — see touchClaim. Fires once right
  // away too, so lastSeenAt exists from the start rather than only after the first
  // interval tick. A missed beat (offline, a backgrounded tab the browser throttled)
  // just means this claim looks very slightly less fresh than it is; the sweep below
  // gives it CLAIM_STALE_AFTER_MS of slack before treating that as actually gone.
  useEffect(() => {
    if (!myUid) return;
    claimsService.touchClaim(myUid).catch(() => {});
    const timer = setInterval(() => {
      claimsService.touchClaim(myUid).catch(() => {});
    }, CLAIM_HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [myUid]);

  // The other half: every open tab (not just a revealer's — turnout accuracy matters
  // to whoever's just trying to vote too) periodically frees up any claim nobody's
  // heartbeat has touched in a while, so a name left over from a closed tab stops
  // counting as "signed in". Reads sweepInputsRef rather than depending on `claims`
  // directly so this timer doesn't restart — and double-fire — every time any
  // browser's heartbeat lands and `claims` updates.
  useEffect(() => {
    const timer = setInterval(() => {
      const { claims: c, statuses, currentWeek } = sweepInputsRef.current;
      claimsService
        .releaseStaleClaims(c, statuses, currentWeek)
        .catch((err) => console.warn('Stale-claim sweep failed:', err instanceof Error ? err.message : err));
    }, CLAIM_HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, []);

  const me = myUid ? profiles[myUid] ?? null : null;
  // See REVEALER_NAMES in types/firestore.ts — KG, Steph, or OB, each independently,
  // not a priority fallback. A revealer votes like anyone else; this only ever gates
  // the reveal action and the Team panel.
  const canReveal = isRevealerProfile(me);

  // Mirrors this browser's stored pick into React state so the vote grid re-renders
  // the moment it changes. localStorage is the source of truth (the server has no
  // copy — that's the point), but reading it during render wouldn't re-run when it's
  // written, leaving the "Voted" tick on the wrong card until something else nudged a
  // render. Re-reads whenever the week changes, so a rollover starts clean. Re-reads
  // on `round` as well as the week: resetting or restarting a round wipes the tally
  // without changing the week key, and bumps round instead — that's the signal this
  // browser's remembered pick no longer refers to anything. See lib/localPick.ts.
  const [myPick, setMyPick] = useState<string | null>(() =>
    getLocalPick(settings.currentWeek, settings.round ?? 0),
  );

  useEffect(() => {
    setMyPick(getLocalPick(settings.currentWeek, settings.round ?? 0));
  }, [settings.currentWeek, settings.round, myUid]);

  // Nobody clicks a button for this — the moment the voting week changes (Friday, per
  // getWeekKey's Thursday-to-Friday boundary), a revealer's client silently clears
  // last week's votes and advances to the new week, whether or not anyone revealed
  // the last one. Voting itself still opens locked — rollWeek leaves votingOpen:false,
  // so a revealer still has to tap Start Voting once the new week lands. Gated on canReveal
  // purely so one of a small trusted set does it rather than every open tab racing —
  // if more than one of KG/Steph/OB happen to be online right at the boundary, they
  // may both attempt it, but the writes are idempotent so that's harmless.
  useEffect(() => {
    if (!loadedSettings || rollingWeek.current || !canReveal) return;
    const key = getWeekKey();
    if (settings.currentWeek === key) return;
    rollingWeek.current = true;
    votingService
      .rollWeek(key)
      .catch((err) => console.warn('Automatic week rollover failed:', err instanceof Error ? err.message : err))
      .finally(() => {
        rollingWeek.current = false;
      });
  }, [loadedSettings, canReveal, settings.currentWeek]);

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

  // Going Home: one vote per device, so this takes back the vote this device cast
  // (only while voting's still open — after a reveal everything's already been wiped,
  // and with voting locked there's nothing live to take back), then frees the name
  // and its stats choice. Votes this person RECEIVED are on their own count and are
  // never touched. Retraction failing must never strand someone unable to leave, so
  // it's best-effort and the sign-out goes ahead regardless.
  const releaseName = useCallback(async () => {
    if (!myUid) return;
    if (myPick && settings.votingOpen && !settings.revealed) {
      await votingService
        .retractVote(myUid, myPick)
        .catch((err) => console.warn('Could not take back vote:', err instanceof Error ? err.message : err));
    }
    clearAllLocalPicks();
    setMyPick(null);
    await claimsService.releaseName(myUid);
    if (justClaimedUid.current === myUid) justClaimedUid.current = null;
    localIdentity.clear();
    setMyUid(null);
  }, [myUid, myPick, settings.votingOpen, settings.revealed]);

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
    canReveal,
    claimName,
    releaseName,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
