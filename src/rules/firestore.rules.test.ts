import { readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

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

  it('allows voting for a real teammate while voting is open', async () => {
    await seedProfile('alice');
    await seedProfile('bob');
    await seedSettings({ votingOpen: true });
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(alice, 'sotw_myvote', 'alice'), { votedForUid: 'bob', ts: null }));
  });

  it('is unreadable by anyone but its own owner — even an admin', async () => {
    await seedProfile('alice');
    await seedProfile('carol', 'admin');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_myvote', 'alice'), { votedForUid: 'bob', ts: null });
    });
    const { getDoc } = await import('firebase/firestore');
    const carol = testEnv.authenticatedContext('carol').firestore();
    await assertFails(getDoc(doc(carol, 'sotw_myvote', 'alice')));
  });
});

describe('sotw_tally', () => {
  it('rejects reads from a non-admin', async () => {
    await seedProfile('alice');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_tally', 'bob'), { count: 3 });
    });
    const { getDoc } = await import('firebase/firestore');
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(getDoc(doc(alice, 'sotw_tally', 'bob')));
  });

  it('allows reads for an admin', async () => {
    await seedProfile('carol', 'admin');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sotw_tally', 'bob'), { count: 3 });
    });
    const { getDoc } = await import('firebase/firestore');
    const carol = testEnv.authenticatedContext('carol').firestore();
    await assertSucceeds(getDoc(doc(carol, 'sotw_tally', 'bob')));
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
});
