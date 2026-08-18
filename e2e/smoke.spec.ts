import { expect, test } from '@playwright/test';

// Covers the unauthenticated flow only — logging in and casting a vote needs the
// Firestore/Auth emulator seeded with a test user, which `npm run test:rules` sets up
// separately for the security-rule invariants. This test is the cheap "did the whole
// app fail to boot" smoke check that runs with nothing but `npm run dev`.
test('logged-out visitor can reach the login and signup forms', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Star Worker of the Week' })).toBeVisible();

  await page.getByRole('button', { name: 'Vote Now' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

  await page.getByRole('button', { name: 'New here? Create an account' }).click();
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();

  expect(errors).toEqual([]);
});
