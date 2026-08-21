import { onAuthStateChanged } from 'firebase/auth';
import { limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  auth,
  balanceRef,
  balancesCol,
  myVoteRef,
  payoutRequestsCol,
  payoutsCol,
  profilesCol,
  settingsRef,
  tallyCol,
} from '@/lib/firebase';
import { canManagePayouts as computeCanManagePayouts, DEFAULT_SETTINGS, isAdmin as computeIsAdmin } from '@/types/firestore';
import type { Profile, Settings } from '@/types/firestore';
import { getWeekKey } from '@/lib/week';
import { rollWeek } from '@/services/voting.service';
import { SessionContext, type PayoutRequestWithId, type PayoutWithId, type SessionState } from './SessionContext';
import type { User } from 'firebase/auth';

function handleErr(setLoadError: (msg: string) => void) {
  return (err: unknown) => {
    console.warn('Firestore error:', err instanceof Error ? err.message : err);
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'permission-denied') {
      setLoadError("Couldn't load your data. Try reloading the page — if it keeps happening, ask an admin to take a look.");
    }
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [authEpoch, setAuthEpoch] = useState(0);
  const [, forceRerender] = useState(0);

  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loadedProfiles, setLoadedProfiles] = useState(false);

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loadedSettings, setLoadedSettings] = useState(false);

  const [myVote, setMyVote] = useState<string | null>(null);
  const [loadedMyVote, setLoadedMyVote] = useState(false);

  const [myBalance, setMyBalance] = useState(0);
  const [loadedMyBalance, setLoadedMyBalance] = useState(false);

  const [tally, setTally] = useState<Record<string, number>>({});
  const [loadedTally, setLoadedTally] = useState(false);

  const [balances, setBalances] = useState<Record<string, number>>({});
  const [loadedBalances, setLoadedBalances] = useState(false);

  const [payoutQueue, setPayoutQueue] = useState<PayoutRequestWithId[]>([]);
  const [myPayout, setMyPayout] = useState<PayoutRequestWithId | null>(null);
  const [payoutHistory, setPayoutHistory] = useState<PayoutWithId[]>([]);

  const [loadErrorMsg, setLoadErrorMsg] = useState<string | null>(null);
  const onErr = handleErr(setLoadErrorMsg);

  const rollingWeek = useRef(false);

  // Auth + the four subscriptions every signed-in user always has.
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthResolved(true);
      setAuthEpoch((e) => e + 1);
      setLoadedProfiles(false);
      setLoadedSettings(false);
      setLoadedMyVote(false);
      setLoadedMyBalance(false);
      setLoadErrorMsg(null);
    });
    return unsubAuth;
  }, []);

  const refreshUser = useCallback(async () => {
    await auth.currentUser?.reload();
    forceRerender((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubProfiles = onSnapshot(
      profilesCol,
      (snap) => {
        const p: Record<string, Profile> = {};
        snap.forEach((d) => (p[d.id] = d.data()));
        setProfiles(p);
        setLoadedProfiles(true);
        setLoadErrorMsg(null);
      },
      onErr,
    );
    const unsubSettings = onSnapshot(
      settingsRef,
      (snap) => {
        setSettings(snap.data() ?? DEFAULT_SETTINGS);
        setLoadedSettings(true);
      },
      onErr,
    );
    const unsubMyVote = onSnapshot(
      myVoteRef(user.uid),
      (snap) => {
        setMyVote(snap.exists() ? snap.data().votedForUid : null);
        setLoadedMyVote(true);
      },
      onErr,
    );
    const unsubMyBalance = onSnapshot(
      balanceRef(user.uid),
      (snap) => {
        setMyBalance(snap.exists() ? snap.data().balance || 0 : 0);
        setLoadedMyBalance(true);
      },
      onErr,
    );
    const unsubMyPayout = onSnapshot(
      query(payoutRequestsCol, where('uid', '==', user.uid)),
      (snap) => {
        let pending: PayoutRequestWithId | null = null;
        snap.forEach((d) => {
          if (d.data().status === 'pending') pending = { id: d.id, ...d.data() };
        });
        setMyPayout(pending);
      },
      onErr,
    );
    return () => {
      unsubProfiles();
      unsubSettings();
      unsubMyVote();
      unsubMyBalance();
      unsubMyPayout();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const me = user ? profiles[user.uid] ?? null : null;
  const admin = computeIsAdmin(me);
  const canManage = computeCanManagePayouts(me, user?.uid, settings);

  // Only admins ever subscribe to every balance at once (Team & balances table) —
  // everyone else only ever reads their own balance, subscribed above.
  useEffect(() => {
    if (!loadedProfiles || !loadedSettings) return;
    if (!admin) {
      setBalances({});
      setLoadedBalances(false);
      return;
    }
    setLoadedBalances(false);
    const unsub = onSnapshot(
      balancesCol,
      (snap) => {
        const b: Record<string, number> = {};
        snap.forEach((d) => (b[d.id] = d.data().balance || 0));
        setBalances(b);
        setLoadedBalances(true);
      },
      onErr,
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedProfiles, loadedSettings, admin]);

  // Only admins ever subscribe to the tally — everyone else just reads
  // settings.winnerUids/totalVotes, which never exposes per-person data. Admins get
  // it both once revealed (the Scoreboard breakdown) AND while voting is still open
  // (so MainScreen can show a live "X votes cast so far" count to help them judge
  // when it's worth ending voting) — firestore.rules already permits admin reads of
  // this collection at any time; this is just the app choosing to use it earlier too.
  useEffect(() => {
    if (!loadedProfiles || !loadedSettings) return;
    if (!(admin && (settings.revealed || settings.votingOpen))) {
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
  }, [loadedProfiles, loadedSettings, settings.revealed, settings.votingOpen, admin]);

  // Only the assigned finance person (or an admin) ever sees the full payout queue.
  useEffect(() => {
    if (!loadedProfiles || !loadedSettings || !canManage) {
      setPayoutQueue([]);
      return;
    }
    const unsub = onSnapshot(
      payoutRequestsCol,
      (snap) => {
        const list: PayoutRequestWithId[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1));
        setPayoutQueue(list);
      },
      onErr,
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedProfiles, loadedSettings, canManage]);

  // Recent payout history (winner bonuses + tie awards) — same audience as the
  // payout-request queue above (admin or the assigned finance holder).
  useEffect(() => {
    if (!loadedProfiles || !loadedSettings || !canManage) {
      setPayoutHistory([]);
      return;
    }
    const unsub = onSnapshot(
      query(payoutsCol, orderBy('ts', 'desc'), limit(25)),
      (snap) => {
        const list: PayoutWithId[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setPayoutHistory(list);
      },
      onErr,
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedProfiles, loadedSettings, canManage]);

  // Nobody clicks a button for this — the moment the voting week changes (Friday,
  // per getWeekKey's Thursday-to-Friday boundary), whichever admin/owner happens to
  // have the app open silently clears the previous week's votes and opens a fresh
  // one, whether or not anyone got around to revealing the last one.
  useEffect(() => {
    if (!loadedProfiles || !loadedSettings || rollingWeek.current || !admin) return;
    const key = getWeekKey();
    if (settings.currentWeek === key) return;
    rollingWeek.current = true;
    rollWeek(Object.keys(profiles), key)
      .catch((err) => console.warn('Automatic week rollover failed:', err instanceof Error ? err.message : err))
      .finally(() => {
        rollingWeek.current = false;
      });
  }, [loadedProfiles, loadedSettings, admin, settings.currentWeek, profiles]);

  const value: SessionState = {
    user,
    authResolving: !authResolved,
    authEpoch,
    refreshUser,
    profiles,
    settings,
    myVote,
    myBalance,
    tally,
    balances,
    payoutQueue,
    myPayout,
    payoutHistory,
    loadedProfiles,
    loadedSettings,
    loadedMyVote,
    loadedMyBalance,
    loadedTally,
    loadedBalances,
    loadErrorMsg,
    me,
    isAdmin: admin,
    canManagePayouts: canManage,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
