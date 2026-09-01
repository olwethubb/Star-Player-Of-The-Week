import { readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

// The regression guard for firestore.rules. This app has no sign-in of any kind —
// not a login screen, not even an invisible one — no roles and no money. It does
// exactly one thing, and makes exactly one promise about how it does it:
//
//   NOBODY LEARNS WHO VOTED FOR WHOM. Nothing in the database records the link
//   between a voter and a candidate; the per-candidate counts are readable only
//   once voting has closed, so watching one move can't be used to infer it either.
//
// Everything else this app used to enforce at the database level (one name per
// person, only KG running the session) is now a convention the app's own UI
// follows, not something these rules can verify — there's no identity here to check
// it against. Every context below is `unauthenticatedContext()`, on purpose: it's
// exactly as privileged as every other context, because these rules don't look at
// request.auth at all.
//
// Run via `npm run test:rules` (wraps `firebase emulators:exec --only firestore`).

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

function client() {
  return testEnv.unauthenticatedContext().firestore();
}

async function seedProfile(uid: string, name: string = uid) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'sotw_profiles', uid), { name });
  });
}

async function seedClaim(uid: string) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'sotw_claims', uid), { claimedAt: null });
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

async function seedStatUp(uid: string, weekKey: string = WEEK) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'sotw_stat_status', uid), { weekKey, status: 'up' });
  });
}

async function seedTally(uid: string, count: number) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'sotw_tally', uid), { count });
  });
}

// ---------------------------------------------------------------------------
// 1. PROFILES
// ---------------------------------------------------------------------------

describe('sotw_profiles', () => {
  it('is readable by anyone, claimed or not', async () => {
    await seedProfile('ob', 'OB');
    await assertSucceeds(getDoc(doc(client(), 'sotw_profiles', 'ob')));
  });

  it('lets anyone create a profile shaped exactly { name }', async () => {
    await assertSucceeds(setDoc(doc(client(), 'sotw_profiles', 'ob'), { name: 'OB' }));
  });

  it('rejects a profile with no name', async () => {
    await assertFails(setDoc(doc(client(), 'sotw_profiles', 'ob'), { name: '' }));
  });

  it('rejects extra fields on create', async () => {
    await assertFails(setDoc(doc(client(), 'sotw_profiles', 'ob'), { name: 'OB', role: 'admin' }));
  });

  it('lets anyone rename a profile', async () => {
    await seedProfile('ob', 'OB');
    await assertSucceeds(updateDoc(doc(client(), 'sotw_profiles', 'ob'), { name: 'Obie' }));
  });

  it('lets anyone set an avatar', async () => {
    await seedProfile('ob', 'OB');
    await assertSucceeds(updateDoc(doc(client(), 'sotw_profiles', 'ob'), { avatarUrl: 'data:image/jpeg;base64,abc' }));
  });

  it('rejects touching a field other than name or avatarUrl', async () => {
    await seedProfile('ob', 'OB');
    await assertFails(updateDoc(doc(client(), 'sotw_profiles', 'ob'), { balance: 300 }));
  });

  it('lets anyone remove a profile', async () => {
    await seedProfile('ob', 'OB');
    await assertSucceeds(deleteDoc(doc(client(), 'sotw_profiles', 'ob')));
  });
});

// ---------------------------------------------------------------------------
// 2. CLAIMS — the one piece of the old identity model still enforced
// ---------------------------------------------------------------------------

describe('sotw_claims', () => {
  it('lets anyone claim a name nobody has taken', async () => {
    await seedProfile('ob', 'OB');
    await assertSucceeds(setDoc(doc(client(), 'sotw_claims', 'ob'), { claimedAt: null }));
  });

  it('rejects claiming a name that is already taken — first write wins', async () => {
    await seedProfile('ob', 'OB');
    await seedClaim('ob');
    await assertFails(setDoc(doc(client(), 'sotw_claims', 'ob'), { claimedAt: null }));
  });

  it('rejects updating an existing claim under any circumstances', async () => {
    await seedProfile('ob', 'OB');
    await seedClaim('ob');
    // Releasing a name is always a delete-then-create, never an update — this is
    // what stops a claim from being silently repointed at all.
    await assertFails(updateDoc(doc(client(), 'sotw_claims', 'ob'), { claimedAt: null }));
  });

  it('rejects extra fields on a claim — this is the doc that must never carry a vote', async () => {
    await seedProfile('ob', 'OB');
    await assertFails(setDoc(doc(client(), 'sotw_claims', 'ob'), { claimedAt: null, votedFor: 'bob' }));
  });

  it('lets anyone release a claim, freeing the name for the next tap', async () => {
    await seedProfile('ob', 'OB');
    await seedClaim('ob');
    await assertSucceeds(deleteDoc(doc(client(), 'sotw_claims', 'ob')));
  });

  it('is readable by anyone, so the picker can grey out taken names', async () => {
    await seedProfile('ob', 'OB');
    await seedClaim('ob');
    await assertSucceeds(getDoc(doc(client(), 'sotw_claims', 'ob')));
  });
});

// ---------------------------------------------------------------------------
// 3. SETTINGS
// ---------------------------------------------------------------------------

describe('sotw_meta', () => {
  it('settings is readable and writable by anyone', async () => {
    await assertSucceeds(setDoc(doc(client(), 'sotw_meta', 'settings'), { currentWeek: WEEK, votingOpen: true }));
    await assertSucceeds(getDoc(doc(client(), 'sotw_meta', 'settings')));
  });

  it('any other doc under sotw_meta is also open — there is nothing left to gate it on', async () => {
    await assertSucceeds(setDoc(doc(client(), 'sotw_meta', 'scratch'), { anything: true }));
  });
});

// ---------------------------------------------------------------------------
// 4. VOTERS — proof someone voted, and nothing else. The privacy guarantee lives here.
// ---------------------------------------------------------------------------

describe('sotw_voters — proof you voted, and nothing else', () => {
  it('lets anyone mark themselves as voted while voting is open', async () => {
    await seedSettingsThisWeek({ votingOpen: true });
    await assertSucceeds(setDoc(doc(client(), 'sotw_voters', 'ob'), { weekKey: WEEK, ts: null }));
  });

  it('rejects writing one while voting is closed', async () => {
    await seedSettingsThisWeek({ votingOpen: false });
    await assertFails(setDoc(doc(client(), 'sotw_voters', 'ob'), { weekKey: WEEK, ts: null }));
  });

  it('rejects a stale weekKey', async () => {
    await seedSettingsThisWeek({ votingOpen: true });
    await assertFails(setDoc(doc(client(), 'sotw_voters', 'ob'), { weekKey: LAST_WEEK, ts: null }));
  });

  it('rejects a marker shape that would carry who you voted for', async () => {
    // This is the rule that makes "nobody knows who voted for whom" true of the
    // database, not merely of the app's own client choosing not to send that field.
    await seedSettingsThisWeek({ votingOpen: true });
    await assertFails(setDoc(doc(client(), 'sotw_voters', 'ob'), { weekKey: WEEK, ts: null, votedForUid: 'bob' }));
  });

  it('is readable by anyone', async () => {
    await seedSettingsThisWeek({ votingOpen: true });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_voters', 'ob'), { weekKey: WEEK, ts: null });
    });
    await assertSucceeds(getDoc(doc(client(), 'sotw_voters', 'ob')));
  });

  it('lets anyone delete a voter marker (the host clearing a week)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_voters', 'ob'), { weekKey: WEEK, ts: null });
    });
    await assertSucceeds(deleteDoc(doc(client(), 'sotw_voters', 'ob')));
  });
});

// ---------------------------------------------------------------------------
// 5. TALLY — counts only, and only once voting has closed
// ---------------------------------------------------------------------------

describe('sotw_tally — counts only, closed to reading while voting is open', () => {
  it('rejects reading it while voting is open, no matter who asks', async () => {
    await seedSettingsThisWeek({ votingOpen: true });
    await seedTally('ob', 3);
    await assertFails(getDoc(doc(client(), 'sotw_tally', 'ob')));
  });

  it('lets anyone read it once voting has closed', async () => {
    await seedSettingsThisWeek({ votingOpen: false });
    await seedTally('ob', 3);
    await assertSucceeds(getDoc(doc(client(), 'sotw_tally', 'ob')));
  });

  it('lets a first vote create a count of exactly 1 for someone up this week', async () => {
    await seedProfile('ob', 'OB');
    await seedStatUp('ob');
    await seedSettingsThisWeek({ votingOpen: true });
    await assertSucceeds(setDoc(doc(client(), 'sotw_tally', 'ob'), { count: 1 }));
  });

  it('rejects creating a count other than 1', async () => {
    await seedProfile('ob', 'OB');
    await seedStatUp('ob');
    await seedSettingsThisWeek({ votingOpen: true });
    await assertFails(setDoc(doc(client(), 'sotw_tally', 'ob'), { count: 5 }));
  });

  it('rejects a first vote for someone who has not declared stats up this week', async () => {
    await seedProfile('ob', 'OB');
    await seedSettingsThisWeek({ votingOpen: true });
    await assertFails(setDoc(doc(client(), 'sotw_tally', 'ob'), { count: 1 }));
  });

  it('rejects nudging a count up by more than one', async () => {
    await seedProfile('ob', 'OB');
    await seedStatUp('ob');
    await seedSettingsThisWeek({ votingOpen: true });
    await seedTally('ob', 3);
    await assertFails(updateDoc(doc(client(), 'sotw_tally', 'ob'), { count: 99 }));
  });

  it('lets a count go up by exactly one for someone still up this week', async () => {
    await seedProfile('ob', 'OB');
    await seedStatUp('ob');
    await seedSettingsThisWeek({ votingOpen: true });
    await seedTally('ob', 3);
    await assertSucceeds(updateDoc(doc(client(), 'sotw_tally', 'ob'), { count: 4 }));
  });

  it('lets a count go down by one even for someone no longer up — a switch to down must not strand a vote', async () => {
    await seedProfile('ob', 'OB');
    // Deliberately no seedStatUp — they switched to 'down' mid-week.
    await seedSettingsThisWeek({ votingOpen: true });
    await seedTally('ob', 3);
    await assertSucceeds(updateDoc(doc(client(), 'sotw_tally', 'ob'), { count: 2 }));
  });

  it('rejects any write once voting is closed', async () => {
    await seedProfile('ob', 'OB');
    await seedStatUp('ob');
    await seedSettingsThisWeek({ votingOpen: false });
    await assertFails(setDoc(doc(client(), 'sotw_tally', 'ob'), { count: 1 }));
  });

  it('during a runoff, rejects a first vote for someone not in the tied set', async () => {
    await seedProfile('ob', 'OB');
    await seedStatUp('ob');
    await seedSettingsThisWeek({ votingOpen: true, runoffUids: ['someone-else'] });
    await assertFails(setDoc(doc(client(), 'sotw_tally', 'ob'), { count: 1 }));
  });

  it('during a runoff, lets a first vote count for someone who IS tied', async () => {
    await seedProfile('ob', 'OB');
    await seedStatUp('ob');
    await seedSettingsThisWeek({ votingOpen: true, runoffUids: ['ob'] });
    await assertSucceeds(setDoc(doc(client(), 'sotw_tally', 'ob'), { count: 1 }));
  });

  it('lets anyone clear a tally doc (rollover / runoff reset)', async () => {
    await seedTally('ob', 3);
    await assertSucceeds(deleteDoc(doc(client(), 'sotw_tally', 'ob')));
  });
});

// ---------------------------------------------------------------------------
// 6. STAT STATUS
// ---------------------------------------------------------------------------

describe('sotw_stat_status — the honest self-report', () => {
  it('lets anyone declare up or down for the current week', async () => {
    await seedSettingsThisWeek();
    await assertSucceeds(setDoc(doc(client(), 'sotw_stat_status', 'ob'), { weekKey: WEEK, status: 'up' }));
  });

  it('rejects a stale weekKey — nobody stays eligible off an old declaration', async () => {
    await seedSettingsThisWeek();
    await assertFails(setDoc(doc(client(), 'sotw_stat_status', 'ob'), { weekKey: LAST_WEEK, status: 'up' }));
  });

  it('rejects a status that is neither up nor down', async () => {
    await seedSettingsThisWeek();
    await assertFails(setDoc(doc(client(), 'sotw_stat_status', 'ob'), { weekKey: WEEK, status: 'sideways' }));
  });

  it('rejects extra fields', async () => {
    await seedSettingsThisWeek();
    await assertFails(setDoc(doc(client(), 'sotw_stat_status', 'ob'), { weekKey: WEEK, status: 'up', note: 'hi' }));
  });

  it('is readable by anyone, and anyone may clear one', async () => {
    await seedStatUp('ob');
    await assertSucceeds(getDoc(doc(client(), 'sotw_stat_status', 'ob')));
    await assertSucceeds(deleteDoc(doc(client(), 'sotw_stat_status', 'ob')));
  });
});

// ---------------------------------------------------------------------------
// 7. WEEKLY ACTIVITY
// ---------------------------------------------------------------------------

describe('sotw_weekly_activity — what is left after the tally is wiped', () => {
  it('lets anyone write one, and records only THAT a vote was received', async () => {
    await assertSucceeds(setDoc(doc(client(), 'sotw_weekly_activity', `${WEEK}_ob`), { uid: 'ob', weekKey: WEEK, received: true }));
  });

  it('is readable by anyone, so streak badges can show on any profile', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_weekly_activity', `${WEEK}_ob`), { uid: 'ob', weekKey: WEEK, received: true });
    });
    await assertSucceeds(getDoc(doc(client(), 'sotw_weekly_activity', `${WEEK}_ob`)));
  });
});
