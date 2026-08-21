/** Seeds the Firebase emulators with a small demo team, so the app's real screens
 * can be driven locally for docs screenshots without touching production data.
 *
 * Run the emulators first:  firebase emulators:start --only auth,firestore
 * Then:                     node scripts/seed-demo.mjs
 */
import { DEMO_SETTINGS, resetEmulators, setDoc, signUp } from './seed-lib.mjs';

export const PASSWORD = 'Demo-Pass-2026!';
export const ME = { name: 'Benita', email: 'benita@blacfox.com', balance: 300 };
export const TEAM = [
  { name: 'Amilio', email: 'amilio@blacfox.com', balance: 450 },
  { name: 'Pinto', email: 'pinto@blacfox.com', balance: 300 },
  { name: 'Laroche', email: 'laroche@blacfox.com', balance: 0 },
  { name: 'Nomonde', email: 'nomonde@blacfox.com', balance: 150 },
  { name: 'Indi', email: 'indi@blacfox.com', balance: 600 },
  { name: 'Jaydon', email: 'jaydon@blacfox.com', balance: 0 },
  { name: 'Emilio', email: 'emilio@blacfox.com', balance: 0 },
  { name: 'Malaika', email: 'malaika@blacfox.com', balance: 0 },
  { name: 'Jerome', email: 'jerome@blacfox.com', balance: 0 },
];

await resetEmulators();

const uids = {};
for (const m of [ME, ...TEAM]) {
  const uid = await signUp(m.email, PASSWORD);
  uids[m.email] = uid;
  await setDoc(`sotw_profiles/${uid}`, { name: m.name, email: m.email, role: 'member' });
  await setDoc(`sotw_balances/${uid}`, { balance: m.balance });
}

await setDoc('sotw_meta/settings', DEMO_SETTINGS);

console.log(`seeded. sign in as ${ME.email} / ${PASSWORD}`);
console.log(JSON.stringify(uids));
