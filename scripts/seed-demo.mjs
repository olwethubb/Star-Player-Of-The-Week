/** Seeds the Firestore emulator with a small demo team, so the app's real screens can
 * be driven locally without touching production data.
 *
 * A candidate has to be BOTH claimed and marked "stats up" (see isEligibleCandidate in
 * firestore.rules), so this seeds claims as well — without them the vote grid comes up
 * empty no matter how many profiles exist. JOINABLE below is deliberately left
 * unclaimed so there's always a name free to join as: KG to run the session, Benita to
 * vote as a normal teammate.
 *
 * Run the emulator first:  firebase emulators:start --only firestore
 * Then:                    node scripts/seed-demo.mjs
 */
import { DEMO_SETTINGS, DEMO_WEEK, fakeUid, resetEmulators, setDoc } from './seed-lib.mjs';

export const HOST = 'KG';
/** Left unclaimed on purpose — these are the names a human can pick when testing. */
export const JOINABLE = [HOST, 'Benita'];
export const TEAM = [
  'Benita',
  'Amilio',
  'Pinto',
  'Laroche',
  'Nomonde',
  'Indi',
  'Jaydon',
  'Emilio',
  'Malaika',
  'Jerome',
];

await resetEmulators();

const uids = {};
for (const name of [HOST, ...TEAM]) {
  const uid = fakeUid(name);
  uids[name] = uid;
  await setDoc(`sotw_profiles/${uid}`, { name });

  // Everyone is a real, claimed participant — including the host, who votes and can be
  // voted for like anyone else and only differs in holding the session controls.
  if (!JOINABLE.includes(name)) {
    await setDoc(`sotw_claims/${uid}`, { claimedAt: null });
  }
  await setDoc(`sotw_stat_status/${uid}`, { weekKey: DEMO_WEEK, status: 'up' });
}

await setDoc('sotw_meta/settings', DEMO_SETTINGS);

console.log('seeded. open the app and pick a name — no sign-in.');
console.log(`free to join as: ${JOINABLE.join(', ')} (everyone else is already claimed)`);
console.log(JSON.stringify(uids, null, 2));
