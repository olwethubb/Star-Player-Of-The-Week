import { readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

// The regression guard for firestore.rules. This app has no login, no roles and no
// money — it does exactly one thing, and it makes exactly two promises about how it
// does it:
//
//   1. ONE NAME, ONE PERSON. If I tap "OB", nobody else can vote as OB. Enforced by
//      sotw_claims being create-only against an anonymous per-browser uid.
//   2. THE HOST SEES COUNTS, NEVER BALLOTS. Nothing in the database records who voted
//      for whom; the per-candidate counts are host-readable only, and only once voting
//      has closed.
//
// Both are properties of the RULES, not of the client — the client is what the rules
// constrain, not the other way around. So they get tested here, against the real
// emulator, rather than against a mocked Firestore.
//
// Run via `npm run test:rules` (wraps `firebase emulators:exec --only firestore`).
// Every authenticated context below is an ANONYMOUS uid — there is no email, no token
// claim and no role to set, because none of those exist any more. A context named
// 'deviceA' is one browser; 'deviceB' is a different browser trying its luck.

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'sotw-rules-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  });
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

const WEEK = '2026-W1';
const LAST_WEEK = '2025-W52';

/** The uid of the roster profile named "KG" in tests that need a host. Deliberately
 * not 'kg' — the rules match on the profile's NAME, never on its document id, and a
 * matching id would hide a rule that accidentally checked the wrong one. */
const KG_UID = 'p_host';

async function seedProfile(uid: string, name: string = uid) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'sotw_profiles', uid), { name });
  });
}

/** `profileUid` is the roster entry; `authUid` is the browser that owns it. */
async function seedClaim(profileUid: string, authUid: string) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'sotw_claims', profileUid), { authUid, claimedAt: null });
  });
}

async function seedSettings(data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'sotw_meta', 'settings'), data);
  });
}

/** Most tally/voter/status tests need `currentWeek` to actually be WEEK, or
 * isUpThisWeek and the weekKey checks mean nothing — this is
 * `seedSettings({ currentWeek: WEEK, ...overrides })`. */
function seedSettingsThisWeek(overrides: Record<string, unknown> = {}) {
  return seedSettings({ currentWeek: WEEK, ...overrides });
}

async function seedHostDoc(profileUid: string, authUid: string) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'sotw_meta', 'host'), { authUid, profileUid });
  });
}

/** The whole host setup in one call: a roster entry named KG, claimed by `authUid`,
 * with the host doc that isHost() actually reads already registered. */
async function seedHost(authUid: string, profileUid: string = KG_UID) {
  await seedProfile(profileUid, 'KG');
  await seedClaim(profileUid, authUid);
  await seedHostDoc(profileUid, authUid);
}

async function seedStatus(uid: string, status: 'up' | 'down', weekKey: string = WEEK) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'sotw_stat_status', uid), { weekKey, status });
  });
}

function seedStatUp(uid: string, weekKey: string = WEEK) {
  return seedStatus(uid, 'up', weekKey);
}

async function seedTally(uid: string, count: number) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'sotw_tally', uid), { count });
  });
}

// ---------------------------------------------------------------------------
// 1. ONE NAME, ONE PERSON
// ---------------------------------------------------------------------------

describe('sotw_claims — one name, one person', () => {
  it('lets a browser claim a name nobody has taken', async () => {
    await seedProfile('ob', 'OB');
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertSucceeds(
      setDoc(doc(deviceA, 'sotw_claims', 'ob'), { authUid: 'deviceA', claimedAt: serverTimestamp() }),
    );
  });

  it('STOPS A SECOND BROWSER FROM CLAIMING A NAME THAT IS ALREADY CLAIMED', async () => {
    // The headline requirement: once I've said I'm OB, nobody else can vote as OB.
    // The claim doc already exists, so this lands as an `update`, and update is `false`.
    await seedProfile('ob', 'OB');
    await seedClaim('ob', 'deviceA');
    const deviceB = testEnv.authenticatedContext('deviceB').firestore();
    await assertFails(setDoc(doc(deviceB, 'sotw_claims', 'ob'), { authUid: 'deviceB', claimedAt: null }));
  });

  it('stops the second browser even when it forges the first browser\'s uid', async () => {
    // Copying the existing doc verbatim doesn't get you in either — it's still an
    // update, and it would also fail the authUid == request.auth.uid check.
    await seedProfile('ob', 'OB');
    await seedClaim('ob', 'deviceA');
    const deviceB = testEnv.authenticatedContext('deviceB').firestore();
    await assertFails(setDoc(doc(deviceB, 'sotw_claims', 'ob'), { authUid: 'deviceA', claimedAt: null }));
  });

  it('rejects repointing an existing claim at a different browser', async () => {
    await seedProfile('ob', 'OB');
    await seedClaim('ob', 'deviceA');
    const deviceB = testEnv.authenticatedContext('deviceB').firestore();
    await assertFails(updateDoc(doc(deviceB, 'sotw_claims', 'ob'), { authUid: 'deviceB' }));
  });

  it('rejects an update even from the browser that legitimately holds the claim', async () => {
    // `allow update: if false` is absolute — releasing a name is delete-then-create,
    // never an edit, so there is no code path where a claim quietly changes hands.
    await seedProfile('ob', 'OB');
    await seedClaim('ob', 'deviceA');
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(updateDoc(doc(deviceA, 'sotw_claims', 'ob'), { claimedAt: serverTimestamp() }));
  });

  it("rejects a claim that names someone else's browser", async () => {
    await seedProfile('ob', 'OB');
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(setDoc(doc(deviceA, 'sotw_claims', 'ob'), { authUid: 'deviceB', claimedAt: null }));
  });

  it('rejects claiming a roster name that does not exist', async () => {
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(setDoc(doc(deviceA, 'sotw_claims', 'ghost'), { authUid: 'deviceA', claimedAt: null }));
  });

  it('rejects smuggling extra fields into a claim', async () => {
    await seedProfile('ob', 'OB');
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(
      setDoc(doc(deviceA, 'sotw_claims', 'ob'), { authUid: 'deviceA', claimedAt: null, votedFor: 'bob' }),
    );
  });

  it('rejects a claim from a browser that is not signed in at all', async () => {
    await seedProfile('ob', 'OB');
    const nobody = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(nobody, 'sotw_claims', 'ob'), { authUid: 'deviceA', claimedAt: null }));
  });

  it('lets the holder release their own name', async () => {
    await seedProfile('ob', 'OB');
    await seedClaim('ob', 'deviceA');
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertSucceeds(deleteDoc(doc(deviceA, 'sotw_claims', 'ob')));
  });

  it("rejects a stranger releasing someone else's name", async () => {
    await seedProfile('ob', 'OB');
    await seedClaim('ob', 'deviceA');
    const deviceB = testEnv.authenticatedContext('deviceB').firestore();
    await assertFails(deleteDoc(doc(deviceB, 'sotw_claims', 'ob')));
  });

  it('lets the host free a name stuck on a browser nobody has any more', async () => {
    // The "lost my phone" path: the host deletes the claim, the person re-claims on
    // their new device. Their profile, streaks and history are untouched.
    await seedHost('deviceKG');
    await seedProfile('ob', 'OB');
    await seedClaim('ob', 'deviceA');
    const host = testEnv.authenticatedContext('deviceKG').firestore();
    await assertSucceeds(deleteDoc(doc(host, 'sotw_claims', 'ob')));
  });

  it('lets a freed name be claimed by a new browser (the full handover)', async () => {
    await seedProfile('ob', 'OB');
    await seedClaim('ob', 'deviceA');
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertSucceeds(deleteDoc(doc(deviceA, 'sotw_claims', 'ob')));
    const deviceB = testEnv.authenticatedContext('deviceB').firestore();
    await assertSucceeds(setDoc(doc(deviceB, 'sotw_claims', 'ob'), { authUid: 'deviceB', claimedAt: null }));
  });

  it('is readable by any signed-in browser — this is how a browser works out who it is', async () => {
    await seedProfile('ob', 'OB');
    await seedClaim('ob', 'deviceA');
    const deviceB = testEnv.authenticatedContext('deviceB').firestore();
    await assertSucceeds(getDoc(doc(deviceB, 'sotw_claims', 'ob')));
  });
});

// ---------------------------------------------------------------------------
// 2. THE HOST
// ---------------------------------------------------------------------------

describe('sotw_meta/host — becoming the host', () => {
  it('lets whoever holds the KG claim register themselves as host', async () => {
    await seedProfile(KG_UID, 'KG');
    await seedClaim(KG_UID, 'deviceKG');
    const deviceKG = testEnv.authenticatedContext('deviceKG').firestore();
    await assertSucceeds(
      setDoc(doc(deviceKG, 'sotw_meta', 'host'), { authUid: 'deviceKG', profileUid: KG_UID }),
    );
  });

  it('matches the KG name case- and whitespace-insensitively', async () => {
    await seedProfile(KG_UID, '  kg ');
    await seedClaim(KG_UID, 'deviceKG');
    const deviceKG = testEnv.authenticatedContext('deviceKG').firestore();
    await assertSucceeds(
      setDoc(doc(deviceKG, 'sotw_meta', 'host'), { authUid: 'deviceKG', profileUid: KG_UID }),
    );
  });

  it('rejects registering as host without actually holding that claim', async () => {
    // deviceB never tapped KG — the profile is claimed by deviceKG.
    await seedProfile(KG_UID, 'KG');
    await seedClaim(KG_UID, 'deviceKG');
    const deviceB = testEnv.authenticatedContext('deviceB').firestore();
    await assertFails(setDoc(doc(deviceB, 'sotw_meta', 'host'), { authUid: 'deviceB', profileUid: KG_UID }));
  });

  it('rejects registering as host when the KG name is unclaimed', async () => {
    await seedProfile(KG_UID, 'KG');
    const deviceB = testEnv.authenticatedContext('deviceB').firestore();
    await assertFails(setDoc(doc(deviceB, 'sotw_meta', 'host'), { authUid: 'deviceB', profileUid: KG_UID }));
  });

  it('rejects registering a profile that is not named KG, even one you do hold', async () => {
    await seedProfile('ob', 'OB');
    await seedClaim('ob', 'deviceA');
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(setDoc(doc(deviceA, 'sotw_meta', 'host'), { authUid: 'deviceA', profileUid: 'ob' }));
  });

  it("rejects nominating someone else's browser as host, before anyone is registered", async () => {
    await seedProfile(KG_UID, 'KG');
    await seedClaim(KG_UID, 'deviceKG');
    const deviceKG = testEnv.authenticatedContext('deviceKG').firestore();
    await assertFails(setDoc(doc(deviceKG, 'sotw_meta', 'host'), { authUid: 'deviceB', profileUid: KG_UID }));
  });

  it('rejects extra fields on the host doc, before anyone is registered', async () => {
    await seedProfile(KG_UID, 'KG');
    await seedClaim(KG_UID, 'deviceKG');
    const deviceKG = testEnv.authenticatedContext('deviceKG').firestore();
    await assertFails(
      setDoc(doc(deviceKG, 'sotw_meta', 'host'), { authUid: 'deviceKG', profileUid: KG_UID, forever: true }),
    );
  });

  it('blocks the generic sotw_meta wildcard from reaching the host doc', async () => {
    // `match /sotw_meta/{other}` (firestore.rules:150ish) also matches literally
    // 'host' — a single-segment wildcard doesn't exclude paths that have their own
    // match block, and Firestore grants access when ANY matching rule allows it. So
    // without `other != 'host'` on that generic block, a sitting host's writes would
    // route through `allow write: if isHost()` there instead of the specific
    // holdsClaim/isHostNamed/keys().hasOnly() guards below — letting them staple
    // arbitrary fields on, or hand the role to a browser that never claimed KG.
    await seedHost('deviceKG');

    // The reassuring half: holding no claim and no host doc still gets you nothing.
    const deviceB = testEnv.authenticatedContext('deviceB').firestore();
    await assertFails(setDoc(doc(deviceB, 'sotw_meta', 'host'), { authUid: 'deviceB', profileUid: KG_UID }));

    // Even the sitting host can't use the wildcard to bypass their own doc's rules:
    // extra fields, or handing the role to a browser that never claimed KG, both fail.
    const host = testEnv.authenticatedContext('deviceKG').firestore();
    await assertFails(
      setDoc(doc(host, 'sotw_meta', 'host'), { authUid: 'deviceKG', profileUid: KG_UID, forever: true }),
    );
    await assertFails(setDoc(doc(host, 'sotw_meta', 'host'), { authUid: 'deviceB', profileUid: KG_UID }));
  });

  it('rejects a signed-out request registering a host', async () => {
    await seedProfile(KG_UID, 'KG');
    const nobody = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(nobody, 'sotw_meta', 'host'), { authUid: 'x', profileUid: KG_UID }));
  });

  it('lets the host stand down', async () => {
    await seedHost('deviceKG');
    const host = testEnv.authenticatedContext('deviceKG').firestore();
    await assertSucceeds(deleteDoc(doc(host, 'sotw_meta', 'host')));
  });

  it('lets whoever holds the KG claim NOW clear a stale host doc', async () => {
    // The old host's browser was wiped; deviceB has since claimed KG. It must be able
    // to displace the stale registration, or the controls stay locked forever.
    await seedProfile(KG_UID, 'KG');
    await seedClaim(KG_UID, 'deviceB');
    await seedHostDoc(KG_UID, 'deviceOldPhone');
    const deviceB = testEnv.authenticatedContext('deviceB').firestore();
    await assertSucceeds(deleteDoc(doc(deviceB, 'sotw_meta', 'host')));
  });

  it('rejects a stranger deleting the host doc', async () => {
    await seedHost('deviceKG');
    const deviceB = testEnv.authenticatedContext('deviceB').firestore();
    await assertFails(deleteDoc(doc(deviceB, 'sotw_meta', 'host')));
  });

  it('is readable by everyone — every client needs to know who is running the session', async () => {
    await seedHost('deviceKG');
    const deviceB = testEnv.authenticatedContext('deviceB').firestore();
    await assertSucceeds(getDoc(doc(deviceB, 'sotw_meta', 'host')));
  });
});

describe('sotw_meta/settings — who controls the session', () => {
  it('lets the host open voting', async () => {
    await seedHost('deviceKG');
    await seedSettingsThisWeek({ votingOpen: false });
    const host = testEnv.authenticatedContext('deviceKG').firestore();
    await assertSucceeds(setDoc(doc(host, 'sotw_meta', 'settings'), { currentWeek: WEEK, votingOpen: true }));
  });

  it('rejects a non-host touching settings once a host exists', async () => {
    await seedHost('deviceKG');
    await seedSettingsThisWeek({ votingOpen: false });
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(setDoc(doc(deviceA, 'sotw_meta', 'settings'), { currentWeek: WEEK, votingOpen: true }));
  });

  it('rejects a non-host reopening voting the host just closed', async () => {
    await seedHost('deviceKG');
    await seedProfile('ob', 'OB');
    await seedClaim('ob', 'deviceA');
    await seedSettingsThisWeek({ votingOpen: false });
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(updateDoc(doc(deviceA, 'sotw_meta', 'settings'), { votingOpen: true }));
  });

  it('BOOTSTRAP: settings is writable by any signed-in client while no host doc exists', async () => {
    // Deliberate: on a fresh project the very first week has to be able to roll over
    // and open before anyone has claimed KG. The window closes the moment a host
    // registers — the test above proves that.
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertSucceeds(setDoc(doc(deviceA, 'sotw_meta', 'settings'), { currentWeek: WEEK, votingOpen: true }));
  });

  it('rejects a signed-OUT caller during the no-host bootstrap window', async () => {
    // The bootstrap branch is `signedIn() && !exists(hostDoc())` — signedIn() still
    // has to hold even though nobody has claimed KG yet, so the pre-host window
    // isn't reachable by a bare unauthenticated request over REST.
    const nobody = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(nobody, 'sotw_meta', 'settings'), { currentWeek: WEEK, votingOpen: true }));
  });

  it('is readable by everyone', async () => {
    await seedSettingsThisWeek({ votingOpen: true });
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertSucceeds(getDoc(doc(deviceA, 'sotw_meta', 'settings')));
  });

  it('locks down any other sotw_meta doc to the host', async () => {
    await seedHost('deviceKG');
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(setDoc(doc(deviceA, 'sotw_meta', 'scratch'), { anything: true }));
    const host = testEnv.authenticatedContext('deviceKG').firestore();
    await assertSucceeds(setDoc(doc(host, 'sotw_meta', 'scratch'), { anything: true }));
  });
});

// ---------------------------------------------------------------------------
// 3. THE HOST SEES COUNTS, NEVER BALLOTS
// ---------------------------------------------------------------------------

describe('sotw_tally — counts are host-only, and only after voting closes', () => {
  it('rejects a read from a non-host even once voting is closed', async () => {
    await seedHost('deviceKG');
    await seedProfile('ob', 'OB');
    await seedClaim('ob', 'deviceA');
    await seedSettingsThisWeek({ votingOpen: false, revealed: true });
    await seedTally('bob', 3);
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(getDoc(doc(deviceA, 'sotw_tally', 'bob')));
  });

  it('rejects a non-host listing the whole tally collection', async () => {
    await seedHost('deviceKG');
    await seedSettingsThisWeek({ votingOpen: false, revealed: true });
    await seedTally('bob', 3);
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(getDocs(collection(deviceA, 'sotw_tally')));
  });

  it('rejects a read from the HOST while voting is still open', async () => {
    // Watching a count tick up live is itself a way to infer who just voted for whom.
    await seedHost('deviceKG');
    await seedSettingsThisWeek({ votingOpen: true, revealed: false });
    await seedTally('bob', 3);
    const host = testEnv.authenticatedContext('deviceKG').firestore();
    await assertFails(getDoc(doc(host, 'sotw_tally', 'bob')));
  });

  it('allows the host to read once voting is closed, before reveal — doReveal needs it to compute a winner at all', async () => {
    await seedHost('deviceKG');
    await seedSettingsThisWeek({ votingOpen: false, revealed: false });
    await seedTally('bob', 3);
    const host = testEnv.authenticatedContext('deviceKG').firestore();
    await assertSucceeds(getDoc(doc(host, 'sotw_tally', 'bob')));
  });

  it('allows the host to list the whole collection once voting is closed', async () => {
    await seedHost('deviceKG');
    await seedSettingsThisWeek({ votingOpen: false, revealed: false });
    await seedTally('bob', 3);
    await seedTally('cass', 1);
    const host = testEnv.authenticatedContext('deviceKG').firestore();
    await assertSucceeds(getDocs(collection(host, 'sotw_tally')));
  });

  it('allows the host to read after reveal too', async () => {
    await seedHost('deviceKG');
    await seedSettingsThisWeek({ votingOpen: false, revealed: true });
    await seedTally('bob', 3);
    const host = testEnv.authenticatedContext('deviceKG').firestore();
    await assertSucceeds(getDoc(doc(host, 'sotw_tally', 'bob')));
  });

  it('rejects a read from a signed-out caller', async () => {
    await seedSettingsThisWeek({ votingOpen: false });
    await seedTally('bob', 3);
    const nobody = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(nobody, 'sotw_tally', 'bob')));
  });
});

describe('sotw_tally — how a count is allowed to move', () => {
  it('allows a first vote for someone who is up this week (create with count: 1)', async () => {
    await seedProfile('bob', 'Bob');
    await seedSettingsThisWeek({ votingOpen: true });
    await seedStatUp('bob');
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertSucceeds(setDoc(doc(deviceA, 'sotw_tally', 'bob'), { count: 1 }));
  });

  it('allows a second vote to nudge the count by exactly +1', async () => {
    await seedProfile('bob', 'Bob');
    await seedSettingsThisWeek({ votingOpen: true });
    await seedStatUp('bob');
    await seedTally('bob', 1);
    const deviceB = testEnv.authenticatedContext('deviceB').firestore();
    await assertSucceeds(setDoc(doc(deviceB, 'sotw_tally', 'bob'), { count: 2 }));
  });

  it('REJECTS AN ARBITRARY JUMP — ballot stuffing', async () => {
    await seedProfile('bob', 'Bob');
    await seedSettingsThisWeek({ votingOpen: true });
    await seedStatUp('bob');
    await seedTally('bob', 1);
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(setDoc(doc(deviceA, 'sotw_tally', 'bob'), { count: 99 }));
  });

  it('rejects a create that starts at anything other than 1', async () => {
    await seedProfile('bob', 'Bob');
    await seedSettingsThisWeek({ votingOpen: true });
    await seedStatUp('bob');
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(setDoc(doc(deviceA, 'sotw_tally', 'bob'), { count: 99 }));
  });

  it('rejects a count that goes negative', async () => {
    await seedProfile('bob', 'Bob');
    await seedSettingsThisWeek({ votingOpen: true });
    await seedTally('bob', 0);
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(setDoc(doc(deviceA, 'sotw_tally', 'bob'), { count: -1 }));
  });

  it('rejects extra fields on a tally doc', async () => {
    await seedProfile('bob', 'Bob');
    await seedSettingsThisWeek({ votingOpen: true });
    await seedStatUp('bob');
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(setDoc(doc(deviceA, 'sotw_tally', 'bob'), { count: 1, votedBy: 'deviceA' }));
  });

  it('rejects any vote while voting is closed', async () => {
    await seedProfile('bob', 'Bob');
    await seedSettingsThisWeek({ votingOpen: false });
    await seedStatUp('bob');
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(setDoc(doc(deviceA, 'sotw_tally', 'bob'), { count: 1 }));
  });

  it("rejects a vote for someone who declared 'down' this week", async () => {
    await seedProfile('bob', 'Bob');
    await seedSettingsThisWeek({ votingOpen: true });
    await seedStatus('bob', 'down');
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(setDoc(doc(deviceA, 'sotw_tally', 'bob'), { count: 1 }));
  });

  it('rejects a vote for someone who has not declared at all this week', async () => {
    await seedProfile('bob', 'Bob');
    await seedSettingsThisWeek({ votingOpen: true });
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(setDoc(doc(deviceA, 'sotw_tally', 'bob'), { count: 1 }));
  });

  it("rejects a vote riding on last week's 'up' declaration", async () => {
    await seedProfile('bob', 'Bob');
    await seedSettingsThisWeek({ votingOpen: true });
    await seedStatUp('bob', LAST_WEEK);
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(setDoc(doc(deviceA, 'sotw_tally', 'bob'), { count: 1 }));
  });

  it('rejects a vote for a uid that is not on the roster', async () => {
    await seedSettingsThisWeek({ votingOpen: true });
    await seedStatUp('ghost');
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(setDoc(doc(deviceA, 'sotw_tally', 'ghost'), { count: 1 }));
  });

  it('rejects a vote from a signed-out caller', async () => {
    await seedProfile('bob', 'Bob');
    await seedSettingsThisWeek({ votingOpen: true });
    await seedStatUp('bob');
    const nobody = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(nobody, 'sotw_tally', 'bob'), { count: 1 }));
  });

  it('allows -1 even for someone no longer up — taking a vote back must never get stuck', async () => {
    // bob is deliberately NOT seeded 'up': someone who switches to 'down' mid-week
    // must not strand an already-cast vote with no way to withdraw it.
    await seedProfile('bob', 'Bob');
    await seedSettingsThisWeek({ votingOpen: true });
    await seedTally('bob', 1);
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertSucceeds(setDoc(doc(deviceA, 'sotw_tally', 'bob'), { count: 0 }));
  });

  it('rejects a -2 drop', async () => {
    await seedProfile('bob', 'Bob');
    await seedSettingsThisWeek({ votingOpen: true });
    await seedTally('bob', 5);
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(setDoc(doc(deviceA, 'sotw_tally', 'bob'), { count: 3 }));
  });

  it('allows only the host to delete a tally doc (rollover / runoff reset)', async () => {
    await seedHost('deviceKG');
    await seedSettingsThisWeek({ votingOpen: false });
    await seedTally('bob', 3);
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(deleteDoc(doc(deviceA, 'sotw_tally', 'bob')));
    const host = testEnv.authenticatedContext('deviceKG').firestore();
    await assertSucceeds(deleteDoc(doc(host, 'sotw_tally', 'bob')));
  });
});

describe('sotw_tally — runoff', () => {
  it('rejects a vote for someone outside the runoff, even though they are up', async () => {
    await seedProfile('bob', 'Bob');
    await seedProfile('cass', 'Cass');
    await seedSettingsThisWeek({ votingOpen: true, runoffUids: ['bob'] });
    await seedStatUp('cass');
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(setDoc(doc(deviceA, 'sotw_tally', 'cass'), { count: 1 }));
  });

  it('allows a vote for a tied candidate during a runoff', async () => {
    await seedProfile('bob', 'Bob');
    await seedProfile('cass', 'Cass');
    await seedSettingsThisWeek({ votingOpen: true, runoffUids: ['bob', 'cass'] });
    await seedStatUp('bob');
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertSucceeds(setDoc(doc(deviceA, 'sotw_tally', 'bob'), { count: 1 }));
  });

  it('rejects an INCREMENT for someone outside the runoff', async () => {
    await seedProfile('cass', 'Cass');
    await seedSettingsThisWeek({ votingOpen: true, runoffUids: ['bob'] });
    await seedStatUp('cass');
    await seedTally('cass', 1);
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(setDoc(doc(deviceA, 'sotw_tally', 'cass'), { count: 2 }));
  });

  it('still allows a DECREMENT for someone outside the runoff', async () => {
    // Same reasoning as the 'down' case: withdrawing a vote must never be blocked.
    await seedProfile('cass', 'Cass');
    await seedSettingsThisWeek({ votingOpen: true, runoffUids: ['bob'] });
    await seedTally('cass', 1);
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertSucceeds(setDoc(doc(deviceA, 'sotw_tally', 'cass'), { count: 0 }));
  });

  it('treats a null runoffUids as "no runoff — everyone who is up is fair game"', async () => {
    await seedProfile('bob', 'Bob');
    await seedSettingsThisWeek({ votingOpen: true, runoffUids: null });
    await seedStatUp('bob');
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertSucceeds(setDoc(doc(deviceA, 'sotw_tally', 'bob'), { count: 1 }));
  });
});

// ---------------------------------------------------------------------------
// 4. THE VOTED MARKER — that you voted, never who for
// ---------------------------------------------------------------------------

describe('sotw_voters — proof you voted, and nothing else', () => {
  it('lets the claim holder mark themselves as having voted', async () => {
    await seedProfile('ob', 'OB');
    await seedClaim('ob', 'deviceA');
    await seedSettingsThisWeek({ votingOpen: true });
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertSucceeds(setDoc(doc(deviceA, 'sotw_voters', 'ob'), { weekKey: WEEK, ts: serverTimestamp() }));
  });

  it('rejects one browser marking someone else as having voted', async () => {
    await seedProfile('ob', 'OB');
    await seedProfile('bob', 'Bob');
    await seedClaim('ob', 'deviceA');
    await seedClaim('bob', 'deviceB');
    await seedSettingsThisWeek({ votingOpen: true });
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(setDoc(doc(deviceA, 'sotw_voters', 'bob'), { weekKey: WEEK, ts: null }));
  });

  it('rejects a marker for a name nobody has claimed', async () => {
    await seedProfile('ob', 'OB');
    await seedSettingsThisWeek({ votingOpen: true });
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(setDoc(doc(deviceA, 'sotw_voters', 'ob'), { weekKey: WEEK, ts: null }));
  });

  it('rejects a marker once voting is closed', async () => {
    await seedProfile('ob', 'OB');
    await seedClaim('ob', 'deviceA');
    await seedSettingsThisWeek({ votingOpen: false });
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(setDoc(doc(deviceA, 'sotw_voters', 'ob'), { weekKey: WEEK, ts: null }));
  });

  it("rejects a marker stamped with a stale week — last week's turnout can't leak into this one", async () => {
    await seedProfile('ob', 'OB');
    await seedClaim('ob', 'deviceA');
    await seedSettingsThisWeek({ votingOpen: true });
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(setDoc(doc(deviceA, 'sotw_voters', 'ob'), { weekKey: LAST_WEEK, ts: null }));
  });

  it('rejects THE HOST marking themselves as voted — the host runs the vote, they are not in it', async () => {
    await seedHost('deviceKG');
    await seedSettingsThisWeek({ votingOpen: true });
    const host = testEnv.authenticatedContext('deviceKG').firestore();
    await assertFails(setDoc(doc(host, 'sotw_voters', KG_UID), { weekKey: WEEK, ts: null }));
  });

  it('rejects overwriting an existing marker on someone else\'s behalf', async () => {
    await seedProfile('ob', 'OB');
    await seedClaim('ob', 'deviceA');
    await seedSettingsThisWeek({ votingOpen: true });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_voters', 'ob'), { weekKey: WEEK, ts: null });
    });
    const deviceB = testEnv.authenticatedContext('deviceB').firestore();
    await assertFails(updateDoc(doc(deviceB, 'sotw_voters', 'ob'), { weekKey: LAST_WEEK }));
  });

  it('is readable by everyone — the host chases whoever has not voted yet', async () => {
    await seedProfile('ob', 'OB');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_voters', 'ob'), { weekKey: WEEK, ts: null });
    });
    const deviceB = testEnv.authenticatedContext('deviceB').firestore();
    await assertSucceeds(getDoc(doc(deviceB, 'sotw_voters', 'ob')));
  });

  it('lets only the host clear markers (rollover / runoff reset)', async () => {
    await seedHost('deviceKG');
    await seedProfile('ob', 'OB');
    await seedClaim('ob', 'deviceA');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_voters', 'ob'), { weekKey: WEEK, ts: null });
    });
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(deleteDoc(doc(deviceA, 'sotw_voters', 'ob')));
    const host = testEnv.authenticatedContext('deviceKG').firestore();
    await assertSucceeds(deleteDoc(doc(host, 'sotw_voters', 'ob')));
  });

  it('rejects a marker shape that would carry who you voted for', async () => {
    // The headline privacy property — nobody, not even the host, can learn who voted
    // for whom — has to be enforced by the database, not merely by the app's own
    // client choosing not to send that field. keys().hasOnly(['weekKey', 'ts'])
    // is what actually stops a patched or hand-rolled client from publishing the
    // voter-to-candidate mapping this design refuses to store anywhere.
    await seedProfile('ob', 'OB');
    await seedClaim('ob', 'deviceA');
    await seedSettingsThisWeek({ votingOpen: true });
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(
      setDoc(doc(deviceA, 'sotw_voters', 'ob'), { weekKey: WEEK, ts: null, votedForUid: 'bob' }),
    );
  });
});

// ---------------------------------------------------------------------------
// 5. STAT STATUS
// ---------------------------------------------------------------------------

describe('sotw_stat_status — the honest self-report', () => {
  it('lets the claim holder declare their own status for this week', async () => {
    await seedProfile('ob', 'OB');
    await seedClaim('ob', 'deviceA');
    await seedSettingsThisWeek();
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertSucceeds(setDoc(doc(deviceA, 'sotw_stat_status', 'ob'), { weekKey: WEEK, status: 'up' }));
  });

  it('lets them change their mind from up to down', async () => {
    await seedProfile('ob', 'OB');
    await seedClaim('ob', 'deviceA');
    await seedSettingsThisWeek();
    await seedStatUp('ob');
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertSucceeds(setDoc(doc(deviceA, 'sotw_stat_status', 'ob'), { weekKey: WEEK, status: 'down' }));
  });

  it("rejects declaring someone else's status", async () => {
    await seedProfile('ob', 'OB');
    await seedProfile('bob', 'Bob');
    await seedClaim('ob', 'deviceA');
    await seedClaim('bob', 'deviceB');
    await seedSettingsThisWeek();
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(setDoc(doc(deviceA, 'sotw_stat_status', 'bob'), { weekKey: WEEK, status: 'up' }));
  });

  it('rejects declaring a status for a name you have not claimed', async () => {
    await seedProfile('ob', 'OB');
    await seedSettingsThisWeek();
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(setDoc(doc(deviceA, 'sotw_stat_status', 'ob'), { weekKey: WEEK, status: 'up' }));
  });

  it('rejects a stale weekKey — nobody stays eligible off an old declaration', async () => {
    await seedProfile('ob', 'OB');
    await seedClaim('ob', 'deviceA');
    await seedSettingsThisWeek();
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(setDoc(doc(deviceA, 'sotw_stat_status', 'ob'), { weekKey: LAST_WEEK, status: 'up' }));
  });

  it('rejects a status that is neither up nor down', async () => {
    await seedProfile('ob', 'OB');
    await seedClaim('ob', 'deviceA');
    await seedSettingsThisWeek();
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(setDoc(doc(deviceA, 'sotw_stat_status', 'ob'), { weekKey: WEEK, status: 'sideways' }));
  });

  it("rejects even the host declaring on someone else's behalf", async () => {
    await seedHost('deviceKG');
    await seedProfile('ob', 'OB');
    await seedClaim('ob', 'deviceA');
    await seedSettingsThisWeek();
    const host = testEnv.authenticatedContext('deviceKG').firestore();
    await assertFails(setDoc(doc(host, 'sotw_stat_status', 'ob'), { weekKey: WEEK, status: 'up' }));
  });

  it('is readable by everyone — the vote screen builds the candidate list from it', async () => {
    await seedStatUp('bob');
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertSucceeds(getDoc(doc(deviceA, 'sotw_stat_status', 'bob')));
  });

  it('lets only the host clear a declaration', async () => {
    await seedHost('deviceKG');
    await seedProfile('ob', 'OB');
    await seedClaim('ob', 'deviceA');
    await seedStatUp('ob');
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(deleteDoc(doc(deviceA, 'sotw_stat_status', 'ob')));
    const host = testEnv.authenticatedContext('deviceKG').firestore();
    await assertSucceeds(deleteDoc(doc(host, 'sotw_stat_status', 'ob')));
  });
});

// ---------------------------------------------------------------------------
// 6. THE ROSTER
// ---------------------------------------------------------------------------

describe('sotw_profiles — the roster', () => {
  it('is readable by any signed-in browser — it is both the vote screen and the name picker', async () => {
    await seedProfile('ob', 'OB');
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertSucceeds(getDoc(doc(deviceA, 'sotw_profiles', 'ob')));
  });

  it('is not readable by a signed-out caller', async () => {
    await seedProfile('ob', 'OB');
    const nobody = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(nobody, 'sotw_profiles', 'ob')));
  });

  it('lets the host add and rename a teammate', async () => {
    await seedHost('deviceKG');
    const host = testEnv.authenticatedContext('deviceKG').firestore();
    await assertSucceeds(setDoc(doc(host, 'sotw_profiles', 'newbie'), { name: 'Newbie' }));
    await assertSucceeds(updateDoc(doc(host, 'sotw_profiles', 'newbie'), { name: 'Newbie Fixed' }));
    await assertSucceeds(deleteDoc(doc(host, 'sotw_profiles', 'newbie')));
  });

  it('rejects a non-host adding themselves to the roster', async () => {
    await seedHost('deviceKG');
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(setDoc(doc(deviceA, 'sotw_profiles', 'gatecrasher'), { name: 'Gatecrasher' }));
  });

  it('lets anyone bootstrap the very first profile on an empty database, but ONLY as KG', async () => {
    // Otherwise this is a chicken-and-egg deadlock: creating a profile normally needs
    // isHost(), isHost() needs sotw_meta/host, and registering that needs a claim on
    // a profile already named KG. The bootstrap branch breaks the cycle the same way
    // sotw_meta/settings does — narrowly, and only while no host is registered yet.
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertSucceeds(setDoc(doc(deviceA, 'sotw_profiles', KG_UID), { name: 'KG' }));
  });

  it('bootstrap accepts KG spelled any case, since isHostNamed matches that way too', async () => {
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertSucceeds(setDoc(doc(deviceA, 'sotw_profiles', KG_UID), { name: '  kg  ' }));
  });

  it('bootstrap rejects any name other than KG', async () => {
    // Otherwise anyone could plant themselves onto an empty roster and immediately
    // add the rest of the team as if they were host, without ever holding the KG claim.
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(setDoc(doc(deviceA, 'sotw_profiles', 'ob'), { name: 'OB' }));
  });

  it('bootstrap rejects extra fields — only a bare { name: "KG" } is allowed', async () => {
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(setDoc(doc(deviceA, 'sotw_profiles', KG_UID), { name: 'KG', avatarUrl: 'x' }));
  });

  it('bootstrap rejects a signed-out caller', async () => {
    const nobody = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(nobody, 'sotw_profiles', KG_UID), { name: 'KG' }));
  });

  it('closes the bootstrap window for good once a host is registered', async () => {
    await seedHost('deviceKG');
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(setDoc(doc(deviceA, 'sotw_profiles', 'someone-else'), { name: 'KG' }));
  });

  it('lets the claim holder set their own avatar', async () => {
    await seedProfile('ob', 'OB');
    await seedClaim('ob', 'deviceA');
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertSucceeds(updateDoc(doc(deviceA, 'sotw_profiles', 'ob'), { avatarUrl: 'data:image/jpeg;base64,abc' }));
  });

  it("rejects setting someone else's avatar", async () => {
    await seedProfile('ob', 'OB');
    await seedProfile('bob', 'Bob');
    await seedClaim('ob', 'deviceA');
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(updateDoc(doc(deviceA, 'sotw_profiles', 'bob'), { avatarUrl: 'data:image/jpeg;base64,abc' }));
  });

  it('rejects renaming yourself to KG through the avatar path — that would be a host takeover', async () => {
    await seedProfile('ob', 'OB');
    await seedClaim('ob', 'deviceA');
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(
      updateDoc(doc(deviceA, 'sotw_profiles', 'ob'), { avatarUrl: 'data:image/jpeg;base64,abc', name: 'KG' }),
    );
  });

  it('rejects renaming yourself at all', async () => {
    await seedProfile('ob', 'OB');
    await seedClaim('ob', 'deviceA');
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(updateDoc(doc(deviceA, 'sotw_profiles', 'ob'), { name: 'Somebody Else' }));
  });

  it('rejects an avatar big enough to be a problem', async () => {
    await seedProfile('ob', 'OB');
    await seedClaim('ob', 'deviceA');
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(updateDoc(doc(deviceA, 'sotw_profiles', 'ob'), { avatarUrl: 'x'.repeat(200001) }));
  });

  it('lets the host set a teammate\'s avatar for them', async () => {
    await seedHost('deviceKG');
    await seedProfile('ob', 'OB');
    const host = testEnv.authenticatedContext('deviceKG').firestore();
    await assertSucceeds(updateDoc(doc(host, 'sotw_profiles', 'ob'), { avatarUrl: 'data:image/jpeg;base64,abc' }));
  });
});

// ---------------------------------------------------------------------------
// 7. WEEKLY ACTIVITY (streaks)
// ---------------------------------------------------------------------------

describe('sotw_weekly_activity — what is left after the tally is wiped', () => {
  it('lets the host write a record at reveal time', async () => {
    await seedHost('deviceKG');
    const host = testEnv.authenticatedContext('deviceKG').firestore();
    await assertSucceeds(
      setDoc(doc(host, 'sotw_weekly_activity', `${WEEK}_ob`), { uid: 'ob', weekKey: WEEK, received: true }),
    );
  });

  it('rejects a non-host writing one', async () => {
    await seedHost('deviceKG');
    await seedProfile('ob', 'OB');
    await seedClaim('ob', 'deviceA');
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertFails(
      setDoc(doc(deviceA, 'sotw_weekly_activity', `${WEEK}_ob`), { uid: 'ob', weekKey: WEEK, received: true }),
    );
  });

  it('is readable by everyone — streak badges show on any profile, not just the host view', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_weekly_activity', `${WEEK}_ob`), {
        uid: 'ob',
        weekKey: WEEK,
        received: true,
      });
    });
    const deviceA = testEnv.authenticatedContext('deviceA').firestore();
    await assertSucceeds(getDoc(doc(deviceA, 'sotw_weekly_activity', `${WEEK}_ob`)));
  });

  it('records only THAT a vote was received — never from whom, and nobody can delete history', async () => {
    await seedHost('deviceKG');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_weekly_activity', `${WEEK}_ob`), {
        uid: 'ob',
        weekKey: WEEK,
        received: true,
      });
    });
    const host = testEnv.authenticatedContext('deviceKG').firestore();
    await assertFails(deleteDoc(doc(host, 'sotw_weekly_activity', `${WEEK}_ob`)));
  });
});
