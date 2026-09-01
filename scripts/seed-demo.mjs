/** Seeds the Firestore emulator with a small demo team, so the app's real screens can
 * be driven locally for docs screenshots without touching production data.
 *
 * There are no accounts to create any more — a teammate is just a profile document,
 * and everyone declares "stats up" here so the vote grid has names on it immediately.
 * KG is on the roster but deliberately left unclaimed, so you can tap into the app as
 * whoever you like, including as the host.
 *
 * Run the emulator first:  firebase emulators:start --only firestore
 * Then:                    node scripts/seed-demo.mjs
 */
import { DEMO_SETTINGS, DEMO_WEEK, fakeUid, resetEmulators, setDoc } from './seed-lib.mjs';

export const HOST = 'KG';
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
  // The host runs the session rather than standing in it, so they're never a candidate.
  if (name !== HOST) {
    await setDoc(`sotw_stat_status/${uid}`, { weekKey: DEMO_WEEK, status: 'up' });
  }
}

await setDoc('sotw_meta/settings', DEMO_SETTINGS);

console.log('seeded. open the app and tap a name — no sign-in.');
console.log(`tap "${HOST}" to run the session (start/end voting, reveal).`);
console.log(JSON.stringify(uids, null, 2));
