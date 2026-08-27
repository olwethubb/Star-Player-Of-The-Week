import { readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

// Covers the invariants that matter most in firestore.rules — the file is meant to stay
// frozen while the frontend gets rewritten, so this suite is the actual regression guard
// for it, not the rewritten client code (which the rules constrain, not the other way
// around). Run via `npm run test:rules` — needs the Firestore emulator (`firebase
// emulators:exec`), not a real project.

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

async function seedProfile(uid: string, role: 'owner' | 'admin' | 'member' = 'member') {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'sotw_profiles', uid), { name: uid, email: `${uid}@blacfox.com`, role });
  });
}

async function seedSettings(data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'sotw_meta', 'settings'), data);
  });
}

const WEEK = '2026-W1';

// Most myvote/tally tests need `currentWeek` to actually be WEEK for isUpThisWeek
// to mean anything — this is `seedSettings({ currentWeek: WEEK, ...overrides })`.
function seedSettingsThisWeek(overrides: Record<string, unknown> = {}) {
  return seedSettings({ currentWeek: WEEK, ...overrides });
}

async function seedStatUp(uid: string, weekKey: string = WEEK) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'sotw_stat_status', uid), { weekKey, status: 'up' });
  });
}

describe('sotw_profiles self-signup', () => {
  it('allows self-signup with any email domain, not just a company one', async () => {
    const alice = testEnv.authenticatedContext('alice', { email: 'alice@gmail.com' }).firestore();
    await assertSucceeds(
      setDoc(doc(alice, 'sotw_profiles', 'alice'), {
        name: 'Alice',
        email: 'alice@gmail.com',
        role: 'member',
      }),
    );
  });

  it("rejects claiming an email that isn't the caller's own verified account email", async () => {
    const alice = testEnv.authenticatedContext('alice', { email: 'alice@gmail.com' }).firestore();
    await assertFails(
      setDoc(doc(alice, 'sotw_profiles', 'alice'), {
        name: 'Alice',
        email: 'someone-else@gmail.com',
        role: 'member',
      }),
    );
  });

  it('rejects self-signup claiming an admin role', async () => {
    const alice = testEnv.authenticatedContext('alice', { email: 'alice@gmail.com' }).firestore();
    await assertFails(
      setDoc(doc(alice, 'sotw_profiles', 'alice'), {
        name: 'Alice',
        email: 'alice@gmail.com',
        role: 'admin',
      }),
    );
  });
});

describe('sotw_profiles avatar updates', () => {
  it('allows setting your own avatar', async () => {
    await seedProfile('alice');
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(updateDoc(doc(alice, 'sotw_profiles', 'alice'), { avatarUrl: 'data:image/jpeg;base64,abc' }));
  });

  it("rejects setting someone else's avatar as a member", async () => {
    await seedProfile('alice');
    await seedProfile('bob');
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(updateDoc(doc(alice, 'sotw_profiles', 'bob'), { avatarUrl: 'data:image/jpeg;base64,abc' }));
  });

  it("allows an admin to set a teammate's avatar", async () => {
    await seedProfile('carol', 'admin');
    await seedProfile('bob');
    const carol = testEnv.authenticatedContext('carol').firestore();
    await assertSucceeds(updateDoc(doc(carol, 'sotw_profiles', 'bob'), { avatarUrl: 'data:image/jpeg;base64,abc' }));
  });

  it("rejects sneaking a role change in through an avatar update", async () => {
    await seedProfile('alice');
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(
      updateDoc(doc(alice, 'sotw_profiles', 'alice'), { avatarUrl: 'data:image/jpeg;base64,abc', role: 'admin' }),
    );
  });
});

describe('sotw_myvote', () => {
  it('rejects voting for yourself', async () => {
    await seedProfile('alice');
    await seedSettings({ votingOpen: true });
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, 'sotw_myvote', 'alice'), { votedForUid: 'alice', ts: null }));
  });

  it('rejects voting while voting is closed', async () => {
    await seedProfile('alice');
    await seedProfile('bob');
    await seedSettings({ votingOpen: false });
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, 'sotw_myvote', 'alice'), { votedForUid: 'bob', ts: null }));
  });

  it('allows voting for a real teammate who is up this week', async () => {
    await seedProfile('alice');
    await seedProfile('bob');
    await seedSettingsThisWeek({ votingOpen: true });
    await seedStatUp('bob');
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(alice, 'sotw_myvote', 'alice'), { votedForUid: 'bob', ts: null }));
  });

  it("rejects voting for someone who's down this week", async () => {
    await seedProfile('alice');
    await seedProfile('bob');
    await seedSettingsThisWeek({ votingOpen: true });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_stat_status', 'bob'), { weekKey: WEEK, status: 'down' });
    });
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, 'sotw_myvote', 'alice'), { votedForUid: 'bob', ts: null }));
  });

  it("rejects voting for someone who hasn't declared a status at all this week", async () => {
    await seedProfile('alice');
    await seedProfile('bob');
    await seedSettingsThisWeek({ votingOpen: true });
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, 'sotw_myvote', 'alice'), { votedForUid: 'bob', ts: null }));
  });

  it("rejects voting for someone whose 'up' declaration is from a past week", async () => {
    await seedProfile('alice');
    await seedProfile('bob');
    await seedSettingsThisWeek({ votingOpen: true });
    await seedStatUp('bob', '2025-W52');
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, 'sotw_myvote', 'alice'), { votedForUid: 'bob', ts: null }));
  });

  it('rejects a vote from a signed-in account with no roster profile', async () => {
    await seedProfile('bob');
    await seedSettings({ votingOpen: true });
    const outsider = testEnv.authenticatedContext('outsider').firestore();
    await assertFails(setDoc(doc(outsider, 'sotw_myvote', 'outsider'), { votedForUid: 'bob', ts: null }));
  });

  it('rejects deleting your own vote while voting is open (delete-then-revote stuffing)', async () => {
    await seedProfile('alice');
    await seedProfile('bob');
    await seedSettings({ votingOpen: true });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_myvote', 'alice'), { votedForUid: 'bob', ts: null });
    });
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(deleteDoc(doc(alice, 'sotw_myvote', 'alice')));
  });

  it('allows deleting your own vote once voting is closed', async () => {
    await seedProfile('alice');
    await seedProfile('bob');
    await seedSettings({ votingOpen: false });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_myvote', 'alice'), { votedForUid: 'bob', ts: null });
    });
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(deleteDoc(doc(alice, 'sotw_myvote', 'alice')));
  });

  it('is unreadable by anyone but its own owner — even an admin', async () => {
    await seedProfile('alice');
    await seedProfile('carol', 'admin');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_myvote', 'alice'), { votedForUid: 'bob', ts: null });
    });
    const carol = testEnv.authenticatedContext('carol').firestore();
    await assertFails(getDoc(doc(carol, 'sotw_myvote', 'alice')));
  });

  it('rejects an admin casting a vote — they run the reveal, so they sit outside it', async () => {
    await seedProfile('carol', 'admin');
    await seedProfile('bob');
    await seedSettings({ votingOpen: true });
    const carol = testEnv.authenticatedContext('carol').firestore();
    await assertFails(setDoc(doc(carol, 'sotw_myvote', 'carol'), { votedForUid: 'bob', ts: null }));
  });

  it('rejects an owner casting a vote too', async () => {
    await seedProfile('olga', 'owner');
    await seedProfile('bob');
    await seedSettings({ votingOpen: true });
    const olga = testEnv.authenticatedContext('olga').firestore();
    await assertFails(setDoc(doc(olga, 'sotw_myvote', 'olga'), { votedForUid: 'bob', ts: null }));
  });

  it('rejects voting for someone outside the current runoff', async () => {
    await seedProfile('alice');
    await seedProfile('bob');
    await seedProfile('carol');
    await seedSettingsThisWeek({ votingOpen: true, runoffUids: ['bob'] });
    await seedStatUp('carol');
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, 'sotw_myvote', 'alice'), { votedForUid: 'carol', ts: null }));
  });

  it('allows voting for a tied candidate during a runoff', async () => {
    await seedProfile('alice');
    await seedProfile('bob');
    await seedProfile('carol');
    await seedSettingsThisWeek({ votingOpen: true, runoffUids: ['bob', 'carol'] });
    await seedStatUp('bob');
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(alice, 'sotw_myvote', 'alice'), { votedForUid: 'bob', ts: null }));
  });
});

describe('sotw_stat_status', () => {
  it('allows declaring your own status for the current week', async () => {
    await seedProfile('alice');
    await seedSettingsThisWeek();
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(alice, 'sotw_stat_status', 'alice'), { weekKey: WEEK, status: 'up' }));
  });

  it('rejects declaring status for a week other than the current one', async () => {
    await seedProfile('alice');
    await seedSettingsThisWeek();
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, 'sotw_stat_status', 'alice'), { weekKey: '2025-W52', status: 'up' }));
  });

  it("rejects declaring someone else's status", async () => {
    await seedProfile('alice');
    await seedProfile('bob');
    await seedSettingsThisWeek();
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, 'sotw_stat_status', 'bob'), { weekKey: WEEK, status: 'up' }));
  });

  it('rejects a status value that is neither up nor down', async () => {
    await seedProfile('alice');
    await seedSettingsThisWeek();
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, 'sotw_stat_status', 'alice'), { weekKey: WEEK, status: 'sideways' }));
  });

  it('lets an admin read stat statuses too — everyone can, this is not sensitive', async () => {
    await seedProfile('carol', 'admin');
    await seedStatUp('alice');
    const carol = testEnv.authenticatedContext('carol').firestore();
    await assertSucceeds(getDoc(doc(carol, 'sotw_stat_status', 'alice')));
  });
});

describe('sotw_weekly_activity', () => {
  it('allows an admin to write a weekly activity record', async () => {
    await seedProfile('carol', 'admin');
    const carol = testEnv.authenticatedContext('carol').firestore();
    await assertSucceeds(
      setDoc(doc(carol, 'sotw_weekly_activity', `${WEEK}_alice`), { uid: 'alice', weekKey: WEEK, received: true }),
    );
  });

  it('rejects a member writing a weekly activity record', async () => {
    await seedProfile('alice');
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(alice, 'sotw_weekly_activity', `${WEEK}_alice`), { uid: 'alice', weekKey: WEEK, received: true }),
    );
  });

  it('is readable by any signed-in member — streak badges need this on the vote screen', async () => {
    await seedProfile('alice');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_weekly_activity', `${WEEK}_bob`), {
        uid: 'bob',
        weekKey: WEEK,
        received: true,
      });
    });
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(getDoc(doc(alice, 'sotw_weekly_activity', `${WEEK}_bob`)));
  });
});

describe('sotw_tally', () => {
  it('rejects reads from a non-admin', async () => {
    await seedProfile('alice');
    await seedSettings({ votingOpen: false, revealed: true });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_tally', 'bob'), { count: 3 });
    });
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(getDoc(doc(alice, 'sotw_tally', 'bob')));
  });

  it('rejects reads from an admin WHILE voting is still open', async () => {
    await seedProfile('carol', 'admin');
    await seedSettings({ votingOpen: true, revealed: false });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_tally', 'bob'), { count: 3 });
    });
    const carol = testEnv.authenticatedContext('carol').firestore();
    await assertFails(getDoc(doc(carol, 'sotw_tally', 'bob')));
  });

  it('allows reads for an admin once voting is closed, even before reveal — doReveal needs this to compute the winner at all', async () => {
    await seedProfile('carol', 'admin');
    await seedSettings({ votingOpen: false, revealed: false });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_tally', 'bob'), { count: 3 });
    });
    const carol = testEnv.authenticatedContext('carol').firestore();
    await assertSucceeds(getDoc(doc(carol, 'sotw_tally', 'bob')));
  });

  it('allows reads for an admin AFTER reveal too', async () => {
    await seedProfile('carol', 'admin');
    await seedSettings({ votingOpen: false, revealed: true });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_tally', 'bob'), { count: 3 });
    });
    const carol = testEnv.authenticatedContext('carol').firestore();
    await assertSucceeds(getDoc(doc(carol, 'sotw_tally', 'bob')));
  });

  it('rejects an arbitrary tally value from a member (ballot stuffing)', async () => {
    await seedProfile('alice');
    await seedSettingsThisWeek({ votingOpen: true });
    await seedStatUp('alice');
    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(aliceDb, 'sotw_tally', 'alice'), { count: 9999 }));
  });

  it('rejects a tally write from a signed-in account with no roster profile', async () => {
    await seedProfile('bob');
    await seedSettingsThisWeek({ votingOpen: true });
    await seedStatUp('bob');
    const outsider = testEnv.authenticatedContext('outsider').firestore();
    await assertFails(setDoc(doc(outsider, 'sotw_tally', 'bob'), { count: 1 }));
  });

  it('allows a legitimate first vote (create with count: 1) for someone up this week', async () => {
    await seedProfile('alice');
    await seedProfile('bob');
    await seedSettingsThisWeek({ votingOpen: true });
    await seedStatUp('bob');
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(alice, 'sotw_tally', 'bob'), { count: 1 }));
  });

  it("rejects a tally create for someone who's down this week", async () => {
    await seedProfile('alice');
    await seedProfile('bob');
    await seedSettingsThisWeek({ votingOpen: true });
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, 'sotw_tally', 'bob'), { count: 1 }));
  });

  it('allows a legitimate re-vote (decrementing the candidate you were just on) even after they later go down', async () => {
    await seedProfile('alice');
    await seedProfile('bob');
    await seedSettingsThisWeek({ votingOpen: true });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'sotw_tally', 'bob'), { count: 1 });
      await setDoc(doc(db, 'sotw_myvote', 'alice'), { votedForUid: 'bob', ts: null });
    });
    // bob is deliberately NOT seeded 'up' — decrementing away from him must still
    // work even once he's no longer eligible, or his stale count could get stuck.
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(alice, 'sotw_tally', 'bob'), { count: 0 }));
  });

  it("rejects decrementing a candidate's tally you never voted for (vote suppression)", async () => {
    await seedProfile('alice');
    await seedProfile('bob');
    await seedSettingsThisWeek({ votingOpen: true });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      // alice has no vote at all, or voted for someone else — either way, not bob.
      await setDoc(doc(context.firestore(), 'sotw_tally', 'bob'), { count: 1 });
    });
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, 'sotw_tally', 'bob'), { count: 0 }));
  });

  it('rejects a tally update that jumps by more than 1', async () => {
    await seedProfile('alice');
    await seedProfile('bob');
    await seedSettingsThisWeek({ votingOpen: true });
    await seedStatUp('bob');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_tally', 'bob'), { count: 1 });
    });
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, 'sotw_tally', 'bob'), { count: 50 }));
  });

  it('rejects an admin nudging a tally — matches them being unable to vote at all', async () => {
    await seedProfile('carol', 'admin');
    await seedProfile('bob');
    await seedSettingsThisWeek({ votingOpen: true });
    await seedStatUp('bob');
    const carol = testEnv.authenticatedContext('carol').firestore();
    await assertFails(setDoc(doc(carol, 'sotw_tally', 'bob'), { count: 1 }));
  });
});

describe('sotw_balances', () => {
  async function seedFinance(uid: string) {
    await seedProfile(uid);
    await seedSettings({ financeUid: uid });
  }

  it('allows finance to LOWER a balance', async () => {
    await seedFinance('fin1');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_balances', 'alice'), { balance: 100 });
    });
    const fin1 = testEnv.authenticatedContext('fin1').firestore();
    await assertSucceeds(updateDoc(doc(fin1, 'sotw_balances', 'alice'), { balance: 50 }));
  });

  it('rejects finance RAISING a balance', async () => {
    await seedFinance('fin1');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_balances', 'alice'), { balance: 100 });
    });
    const fin1 = testEnv.authenticatedContext('fin1').firestore();
    await assertFails(updateDoc(doc(fin1, 'sotw_balances', 'alice'), { balance: 999999 }));
  });

  it('rejects a member raising their own balance', async () => {
    await seedProfile('alice');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_balances', 'alice'), { balance: 100 });
    });
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(updateDoc(doc(alice, 'sotw_balances', 'alice'), { balance: 999999 }));
  });

  it('rejects a negative or non-integer balance from an admin', async () => {
    await seedProfile('carol', 'admin');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_balances', 'alice'), { balance: 100 });
    });
    const carol = testEnv.authenticatedContext('carol').firestore();
    await assertFails(updateDoc(doc(carol, 'sotw_balances', 'alice'), { balance: -5 }));
    await assertFails(updateDoc(doc(carol, 'sotw_balances', 'alice'), { balance: 12.5 }));
  });

  it('allows an admin to set a balance to any valid amount', async () => {
    await seedProfile('carol', 'admin');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_balances', 'alice'), { balance: 100 });
    });
    const carol = testEnv.authenticatedContext('carol').firestore();
    await assertSucceeds(updateDoc(doc(carol, 'sotw_balances', 'alice'), { balance: 250 }));
  });
});

describe('sotw_payout_requests', () => {
  it('rejects a request for more than the caller\'s own balance', async () => {
    await seedProfile('alice');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_balances', 'alice'), { balance: 50 });
    });
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(alice, 'sotw_payout_requests', 'req1'), {
        uid: 'alice',
        name: 'alice',
        amount: 500,
        status: 'pending',
      }),
    );
  });

  it('allows a request within the caller\'s own balance', async () => {
    await seedProfile('alice');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_balances', 'alice'), { balance: 500 });
    });
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(
      setDoc(doc(alice, 'sotw_payout_requests', 'req1'), {
        uid: 'alice',
        name: 'alice',
        amount: 50,
        status: 'pending',
      }),
    );
  });

  it('allows the requester to cancel their own pending request', async () => {
    await seedProfile('alice');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_payout_requests', 'req1'), {
        uid: 'alice',
        name: 'alice',
        amount: 50,
        status: 'pending',
      });
    });
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(updateDoc(doc(alice, 'sotw_payout_requests', 'req1'), { status: 'cancelled' }));
  });

  it('rejects the requester raising the amount while "cancelling"', async () => {
    await seedProfile('alice');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'sotw_balances', 'alice'), { balance: 500 });
      await setDoc(doc(db, 'sotw_payout_requests', 'req1'), {
        uid: 'alice',
        name: 'alice',
        amount: 50,
        status: 'pending',
      });
    });
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(
      updateDoc(doc(alice, 'sotw_payout_requests', 'req1'), { status: 'cancelled', amount: 999999 }),
    );
  });

  it('rejects an admin rewriting an unrelated field on an update', async () => {
    await seedProfile('carol', 'admin');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_payout_requests', 'req1'), {
        uid: 'alice',
        name: 'alice',
        amount: 50,
        status: 'pending',
      });
    });
    const carol = testEnv.authenticatedContext('carol').firestore();
    await assertFails(updateDoc(doc(carol, 'sotw_payout_requests', 'req1'), { status: 'paid', amount: 999999 }));
  });

  it('allows an admin to approve within the allowed field set', async () => {
    await seedProfile('carol', 'admin');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_payout_requests', 'req1'), {
        uid: 'alice',
        name: 'alice',
        amount: 50,
        status: 'pending',
      });
    });
    const carol = testEnv.authenticatedContext('carol').firestore();
    await assertSucceeds(
      updateDoc(doc(carol, 'sotw_payout_requests', 'req1'), {
        status: 'paid',
        resolvedAt: null,
        resolvedBy: 'carol',
      }),
    );
  });
});

describe('sotw_balance_adjustments', () => {
  it('allows an admin to write an adjustment record', async () => {
    await seedProfile('carol', 'admin');
    const carol = testEnv.authenticatedContext('carol').firestore();
    await assertSucceeds(
      setDoc(doc(carol, 'sotw_balance_adjustments', 'adj1'), {
        uid: 'alice',
        from: 100,
        to: 150,
        adjustedBy: 'carol',
        ts: null,
      }),
    );
  });

  it('rejects a member writing an adjustment record', async () => {
    await seedProfile('alice');
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(alice, 'sotw_balance_adjustments', 'adj1'), {
        uid: 'alice',
        from: 100,
        to: 999999,
        adjustedBy: 'alice',
        ts: null,
      }),
    );
  });

  it('allows finance to read adjustment history', async () => {
    await seedProfile('fin1');
    await seedSettings({ financeUid: 'fin1' });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_balance_adjustments', 'adj1'), {
        uid: 'alice',
        from: 100,
        to: 150,
        adjustedBy: 'carol',
        ts: null,
      });
    });
    const fin1 = testEnv.authenticatedContext('fin1').firestore();
    await assertSucceeds(getDoc(doc(fin1, 'sotw_balance_adjustments', 'adj1')));
  });

  it('rejects a member reading adjustment history', async () => {
    await seedProfile('alice');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_balance_adjustments', 'adj1'), {
        uid: 'alice',
        from: 100,
        to: 150,
        adjustedBy: 'carol',
        ts: null,
      });
    });
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(getDoc(doc(alice, 'sotw_balance_adjustments', 'adj1')));
  });

  it('rejects editing a past adjustment record (append-only)', async () => {
    await seedProfile('carol', 'admin');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_balance_adjustments', 'adj1'), {
        uid: 'alice',
        from: 100,
        to: 150,
        adjustedBy: 'carol',
        ts: null,
      });
    });
    const carol = testEnv.authenticatedContext('carol').firestore();
    await assertFails(updateDoc(doc(carol, 'sotw_balance_adjustments', 'adj1'), { to: 999999 }));
  });
});
