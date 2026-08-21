/** Captures the app's real screens as phone-sized images for the team handbook.
 *
 * Needs the emulators running and a dev server pointed at them:
 *   firebase emulators:start --only auth,firestore
 *   VITE_USE_EMULATORS=1 npx vite --port 5199
 *   node scripts/capture-doc-shots.mjs
 *
 * Seeds its own demo team, so it fully controls the state each shot is taken in.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { DEMO_SETTINGS, resetEmulators, setDoc, signUp } from './seed-lib.mjs';

const URL = 'http://localhost:5199';
const OUT = 'docs/screenshots';
const PASSWORD = 'Demo-Pass-2026!';
const ME = { name: 'Zanele Mokoena', email: 'zanele@blacfox.com', balance: 300 };
const TEAM = [
  { name: 'Thandiwe Mabaso', email: 'thandiwe@blacfox.com', balance: 450 },
  { name: 'Sipho Ndlovu', email: 'sipho@blacfox.com', balance: 300 },
  { name: 'Lerato Khumalo', email: 'lerato@blacfox.com', balance: 0 },
  { name: 'Ayanda Zulu', email: 'ayanda@blacfox.com', balance: 150 },
  { name: 'Naledi Botha', email: 'naledi@blacfox.com', balance: 600 },
  { name: 'Kagiso Dlamini', email: 'kagiso@blacfox.com', balance: 0 },
];

mkdirSync(OUT, { recursive: true });

await resetEmulators();
const uids = {};
for (const m of [ME, ...TEAM]) {
  const uid = await signUp(m.email, PASSWORD);
  uids[m.email] = uid;
  await setDoc(`sotw_profiles/${uid}`, { name: m.name, email: m.email, role: 'member' });
  await setDoc(`sotw_balances/${uid}`, { balance: m.balance });
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

// 1. The sign-in screen — the first thing anyone sees.
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.getByRole('button', { name: 'Vote Now' }).click();
await page.waitForTimeout(700);
await shot('01-signin');

// 2. The vote list, open and untouched.
await page.getByLabel('Email').fill(ME.email);
await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
await page.getByRole('button', { name: 'Log in' }).click();
await page.getByRole('button', { name: 'Vote', exact: true }).first().waitFor({ timeout: 20000 });
await page.waitForTimeout(1200);
const grid = page.locator('div.grid').first();
await shot('02-vote-list', grid);

// 3. A vote locked in.
await page.getByRole('button', { name: 'Vote', exact: true }).first().click();
await page.getByRole('button', { name: 'Voted' }).first().waitFor({ timeout: 15000 });
await page.waitForTimeout(700);
await shot('03-voted', grid.locator('> div').first());

// 4. The cash-out card with an amount entered.
await page.getByLabel('Amount to cash out').fill('300');
await page.waitForTimeout(400);
await shot('04-cashout', page.locator('div.rounded-2xl.shadow-card').first());

// 5. The result once an admin reveals it.
await setDoc('sotw_meta/settings', {
  ...DEMO_SETTINGS,
  revealed: true,
  totalVotes: 6,
  winnerUids: [uids['thandiwe@blacfox.com']],
  bonusAwardedUids: [uids['thandiwe@blacfox.com']],
});
await page.reload({ waitUntil: 'load' });
await page.getByText('Results', { exact: true }).waitFor({ timeout: 25000 });
await page.waitForTimeout(1200);
// Crop to the winner card rather than the whole viewport — the results screen is
// mostly empty below it, and that dead space reads as a broken image in the doc.
await shot('05-results', page.locator('div.animate-reveal-in').first());

await browser.close();
console.log('done');
