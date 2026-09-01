import { expect, test, type ConsoleMessage } from '@playwright/test';

/** The app can't render anything decisive until anonymous sign-in has resolved
 * against the real Firebase project, which is a network round trip on a cold start —
 * comfortably longer than Playwright's 5s default assertion timeout. */
const BOOT_MS = 20_000;

/** Console noise from the Firebase SDK and from its own network calls. It appears
 * whenever this machine can't reach the project — offline, rules not published,
 * anonymous sign-in not enabled yet — and says nothing about whether the app booted.
 * That case is covered by the load-error branch asserted below, not by demanding
 * console silence. Anything else, including any error thrown by app code, still
 * fails the test. */
function isBackendNoise(msg: ConsoleMessage): boolean {
  return /^@firebase\//.test(msg.text()) || /(googleapis|gstatic|firebaseio)\.com/.test(msg.location().url);
}

// The cheap "did the whole app fail to boot" check: it needs nothing but `npm run dev`
// and no seeded data. There is no login to walk through any more — the first screen is
// the name picker — and casting an actual vote needs a claimed name plus an open
// voting window, which `npm run test:rules` covers against the emulator instead.
test('the app boots straight into the name picker, with nothing to sign in to', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !isBackendNoise(msg)) errors.push(msg.text());
  });

  await page.goto('/');

  // Two outcomes are legitimate here and the test has to accept both or it's flaky:
  // the picker itself, or the picker's load-error branch when the backend is out of
  // reach. Either way React mounted and rendered a real screen, which is what a smoke
  // test is here to prove — a blank page or a crash matches neither.
  const picker = page.getByRole('heading', { name: 'Star Player of the Week' });
  const loadFailed = page.getByText(/Couldn.t (load the vote|start a session)/);
  await expect(picker.or(loadFailed)).toBeVisible({ timeout: BOOT_MS });

  if (await picker.isVisible()) {
    await expect(page.getByText('Who are you?')).toBeVisible();
    // An empty roster is a rendered state, not a failure — which is what keeps this
    // test free of any seeding requirement.
    const emptyRoster = page.getByText(/Nobody.s on the roster yet/);
    const rosterRows = page.getByRole('listitem');
    await expect(emptyRoster.or(rosterRows.first())).toBeVisible();
  }

  // The rewrite removed every credential surface. Asserting their absence is what
  // stops one quietly reappearing: on this screen the app asks for nothing at all,
  // so a single input element anywhere is already a regression.
  await expect(page.getByRole('heading', { name: 'Sign in' })).toHaveCount(0);
  await expect(page.locator('input')).toHaveCount(0);

  expect(errors).toEqual([]);
});
