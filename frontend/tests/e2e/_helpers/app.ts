import { expect, type APIRequestContext, type Page } from '@playwright/test';

import { DEMO_TOTP, freshTotp } from './totp';

/**
 * Seeded demo users of the local API profile (`db/seed-local`), all with password Demo@1234.
 * Kry Sonita owns Nita Gadget Store (seller); Try Dana owns Glow Beauty Salon (provider).
 */
export const DEMO = { email: 'nita@virtualbiz.com', password: 'Demo@1234' } as const;
export const DANA = { email: 'hello@glowbeauty.com.kh', password: 'Demo@1234' } as const;
export const DOM = { email: 'dom@virtualbiz.com', password: 'Demo@1234' } as const;

export interface Account {
  email: string;
  password: string;
}

/** Fill the one-screen "Log in" form (email + password) and submit it. */
export async function fillLogin(
  page: Page,
  email: string = DEMO.email,
  password: string = DEMO.password,
) {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
}

/** Sign in through the real /sign-in page, landing on `next`. */
export async function signIn(page: Page, next = '/home', account: Account = DEMO) {
  await page.goto(`/en/sign-in?next=${encodeURIComponent(next)}`);
  await fillLogin(page, account.email, account.password);
  // A cold dev server compiles the target route on first visit, so allow more than 5 s.
  await expect(page).toHaveURL(new RegExp(`/en${next.replace(/[/?]/g, '\\$&')}`), {
    timeout: 20_000,
  });
  // Staff with two-step sign-in on (optional unless VBIZ_STAFF_MFA_REQUIRED): enter a code
  // when the console asks for one.
  const key = DEMO_TOTP[account.email];
  if (key && next.startsWith('/admin')) {
    const gate = page.getByRole('heading', { name: 'Two-step sign-in' });
    if (await gate.isVisible({ timeout: 3_000 }).catch(() => false)) await passTwoStep(page, key);
  }
}

/** Enter a fresh authenticator code at the console's "Two-step sign-in" step. */
export async function passTwoStep(page: Page, secret: string) {
  const gate = page.getByRole('heading', { name: 'Two-step sign-in' });
  await expect(gate).toBeVisible({ timeout: 20_000 });
  await page.getByLabel('6-digit code from the app').fill(await freshTotp(secret));
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(gate).toBeHidden();
}

export const uniqueEmail = (tag: string) =>
  `${tag}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.com`;

/**
 * A fresh account made straight through the API (sign-up + the dev code), for tests that
 * change a password or lock an account, so the shared demo users stay untouched.
 */
export async function createAccount(
  request: APIRequestContext,
  name = 'Sok Dara',
  password = 'Bright#2026',
): Promise<Account> {
  const email = uniqueEmail('e2e');
  const sent = await request.post('/api/auth/signup', { data: { name, email, password } });
  expect(sent.ok(), await sent.text()).toBe(true);
  const code = (await sent.json()).data?.devCode as string | undefined;
  expect(code, 'devCode (run the API with the local profile)').toBeTruthy();
  const verified = await request.post('/api/auth/signup/verify', { data: { email, code } });
  expect(verified.ok(), await verified.text()).toBe(true);
  return { email, password };
}

/** Sign out without the UI: drop the refresh cookie and the persisted user. */
export async function forgetSession(page: Page) {
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.removeItem('vb-session'));
}

const sentCodes = new WeakMap<Page, string>();

/**
 * Remember the codes the API sends from now on. The app never shows a code (it goes by email
 * or SMS); the local API profile also returns it as `devCode`, which the tests type in like a
 * person copying it from the email. Call before the step that sends the code.
 */
export function watchCodes(page: Page) {
  page.on('response', async (r) => {
    if (
      r.request().method() !== 'POST' ||
      !/\/api\/auth\/(otp|signup)$/.test(new URL(r.url()).pathname)
    )
      return;
    const code = (await r.json().catch(() => null))?.data?.devCode as string | undefined;
    if (code) sentCodes.set(page, code);
  });
}

/** Type the last code the API sent (see `watchCodes`) into the 6 boxes. */
export async function fillDemoCode(page: Page) {
  await expect.poll(() => sentCodes.get(page), { message: 'a code was sent' }).toBeTruthy();
  await page.getByRole('group', { name: '6-digit code' }).getByRole('textbox').first().click();
  await page.keyboard.type(sentCodes.get(page)!);
}

/** Collect page errors and console errors (ignores 404s for not-yet-built routes). */
export function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

/** Picks `day` (YYYY-MM-DD) in the shared date picker named `label` ("Starts", "Period"…). */
export async function pickDay(page: Page, label: string, day: string) {
  await page.getByRole('button', { name: new RegExp(`^${label}: `) }).click();
  const cal = page.getByRole('dialog', { name: label });
  // Flip months until the day shows (it opens on the picked day, or today).
  for (let i = 0; i < 24 && !(await cal.locator(`[data-day="${day}"]`).count()); i++) {
    const shown = await cal.locator('[data-day]').first().getAttribute('data-day');
    await cal.getByRole('button', { name: shown! < day ? 'Next month' : 'Previous month' }).click();
  }
  await cal.locator(`[data-day="${day}"]`).first().click();
}
