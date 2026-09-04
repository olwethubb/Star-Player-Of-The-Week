/** Captures the app's real screens as phone-sized images for the team handbook.
 *
 * Needs the emulator running and a dev server pointed at it:
 *   firebase emulators:start --only firestore
 *   VITE_USE_EMULATORS=1 npx vite --port 5210
 *   node scripts/capture-doc-shots.mjs
 *
 * Seeds its own demo team, so it fully controls the state each shot is taken in.
 * There's no Auth emulator to start any more — the app has no sign-in of any kind.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { DEMO_SETTINGS, DEMO_WEEK, fakeUid, resetEmulators, setDoc } from './seed-lib.mjs';

const URL = 'http://localhost:5210';
const OUT = 'docs/screenshots';
const HOST = 'KG';
const ME = 'Benita';
const TEAM = ['Amilio', 'Pinto', 'Laroche', 'Nomonde', 'Indi', 'Jaydon'];

mkdirSync(OUT, { recursive: true });

await resetEmulators();
const uids = {};
for (const name of [HOST, ME, ...TEAM]) {
  const uid = fakeUid(name);
  uids[name] = uid;
  await setDoc(`sotw_profiles/${uid}`, { name });
  // A candidate must be claimed AND marked up (isEligibleCandidate in
  // firestore.rules), so the shot of the vote grid needs claims seeded too. ME and
  // HOST stay unclaimed — this script joins as each of them in turn below.
  if (name !== ME && name !== HOST) {
    await setDoc(`sotw_claims/${uid}`, { claimedAt: null });
  }
  await setDoc(`sotw_stat_status/${uid}`, { weekKey: DEMO_WEEK, status: 'up' });
}
await setDoc('sotw_meta/settings', DEMO_SETTINGS);
console.log('seeded demo team');

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 900 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

async function shot(name, locator) {
  // Park the cursor and drop focus first — a hovered card or a focus ring left over
  // from the previous step reads as a highlighted row that nothing in the doc explains.
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await page.waitForTimeout(300);
  await (locator ?? page).screenshot({ path: `${OUT}/${name}.png` });
  console.log('captured', name);
}

// 1. The name picker — the first and only thing standing between you and voting.
await page.goto(URL, { waitUntil: 'networkidle' });
await page.getByText('Who are you?').waitFor({ timeout: 25000 });
await page.waitForTimeout(600);
await shot('01-pick-name');

// 2. The vote list, open and untouched.
await page.getByRole('combobox').selectOption({ label: ME });
await page.getByRole('button', { name: 'Join', exact: true }).click();
await page.getByRole('button', { name: 'Vote', exact: true }).first().waitFor({ timeout: 20000 });
await page.waitForTimeout(1200);
const grid = page.locator('div.grid').first();
await shot('02-vote-list', grid);

// 3. A vote locked in.
await page.getByRole('button', { name: 'Vote', exact: true }).first().click();
await page.getByRole('button', { name: 'Voted' }).first().waitFor({ timeout: 15000 });
await page.waitForTimeout(700);
await shot('03-voted', grid.locator('> div').first());

// 4. The result once the host reveals it.
await setDoc('sotw_meta/settings', {
  ...DEMO_SETTINGS,
  votingOpen: false,
  revealed: true,
  totalVotes: 6,
  winnerUids: [uids['Amilio']],
});
await page.reload({ waitUntil: 'load' });
await page.getByText('Results', { exact: true }).waitFor({ timeout: 25000 });
await page.waitForTimeout(1200);
// Crop to the winner card rather than the whole viewport — the results screen is
// mostly empty below it, and that dead space reads as a broken image in the doc.
await shot('04-results', page.locator('div.animate-reveal-in').first());

await browser.close();
console.log('done');
