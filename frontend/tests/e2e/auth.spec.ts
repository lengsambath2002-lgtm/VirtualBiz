import { expect as baseExpect, type Page, test } from '@playwright/test';

import {
  createAccount,
  DEMO,
  fillDemoCode,
  watchCodes,
  fillLogin,
  signIn,
  trackErrors,
  uniqueEmail,
} from './_helpers/app';

/** The persisted session's user email (null when signed out). */
const storedEmail = (page: Page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem('vb-session');
    const user = raw ? JSON.parse(raw).state?.user : null;
    return user ? (user.email ?? user.phone ?? '') : null;
  });

// Signing in navigates to a route a cold dev server may still be compiling.
const expect = baseExpect.configure({ timeout: 20_000 });

test.describe('Log in (/sign-in)', () => {
  test('email and password on one screen open the app', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/en/sign-in');
    await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
    // No Terms sentence on the log-in page.
    await expect(page.getByText(/you agree to/i)).toHaveCount(0);
    await fillLogin(page);
    await expect(page).toHaveURL(/\/en\/home$/);
    expect(await storedEmail(page)).toBe(DEMO.email);
    expect(errors).toEqual([]);
  });

  test('workspace sends signed-out users to sign-in and back', async ({ page }) => {
    await page.goto('/en/seller/orders');
    await expect(page).toHaveURL(/\/en\/sign-in\?next=%2Fseller%2Forders/);
    await signIn(page, '/seller/orders');
  });

  test('rejects a wrong password and counts tries', async ({ page, request }) => {
    // A fresh account: 5 wrong tries lock it on the server for 30 s.
    const acct = await createAccount(request);
    await page.goto('/en/sign-in');
    await fillLogin(page, acct.email, 'Wrong@1234');
    await expect(page.getByRole('alert').filter({ hasText: 'Wrong password' })).toBeVisible();
    await expect(page).toHaveURL(/\/en\/sign-in$/);
    for (let i = 0; i < 3; i++)
      await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: '1 more try' })).toBeVisible();
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Too many attempts' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Try again in/ })).toBeDisabled();
  });

  test('unknown email links to sign-up carrying the email', async ({ page }) => {
    const email = uniqueEmail('nobody');
    await page.goto('/en/sign-in?next=%2Fseller');
    await fillLogin(page, email, 'Whatever#1');
    const err = page.locator('#e-email');
    await expect(err).toContainText('No account uses this email.');
    await err.getByRole('link', { name: 'Create an account' }).click();
    await expect(page).toHaveURL(/\/en\/sign-up\?/);
    const url = new URL(page.url());
    expect(url.searchParams.get('email')).toBe(email);
    expect(url.searchParams.get('next')).toBe('/seller');
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    await expect(page.getByLabel('Email')).toHaveValue(email);
  });

  test('ignores off-site next links', async ({ page }) => {
    await page.goto('/en/sign-in?next=https%3A%2F%2Fevil.example');
    await fillLogin(page);
    await expect(page).toHaveURL(/\/en\/home$/);
  });

  test('forgot password: code, new password, signed in', async ({ page, request }) => {
    watchCodes(page);
    // A fresh account, so the demo user's password stays Demo@1234 for the other tests.
    const acct = await createAccount(request);
    await page.goto('/en/sign-in?next=%2Fcart');
    await page.getByLabel('Email').fill(acct.email);
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await expect(page).toHaveURL(/step=reset-code/);
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
    await fillDemoCode(page);
    await expect(page).toHaveURL(/step=new-password/);
    // Can't reuse the old password.
    await page.getByLabel('New password', { exact: true }).fill(acct.password);
    await page.getByRole('button', { name: 'Save and log in' }).click();
    await expect(page.getByText("Use a password you haven't used before.")).toBeVisible();
    await page.getByLabel('New password', { exact: true }).fill('Fresh#2026x');
    await page.getByRole('button', { name: 'Save and log in' }).click();
    await expect(page).toHaveURL(/\/en\/cart$/);
    expect(await storedEmail(page)).toBe(acct.email);
  });

  test('email me a login code instead', async ({ page }) => {
    watchCodes(page);
    await page.goto('/en/sign-in');
    await page.getByLabel('Email').fill(DEMO.email);
    await page.getByRole('button', { name: 'Email me a login code instead' }).click();
    await expect(page).toHaveURL(/step=email-code/);
    await fillDemoCode(page);
    await expect(page).toHaveURL(/\/en\/home$/);
  });

  test('steps live in the URL: back/forward work, missing state falls back', async ({ page }) => {
    await page.goto('/en/sign-in');
    await page.getByRole('button', { name: 'Continue with phone number' }).click();
    await expect(page).toHaveURL(/step=phone/);
    await page.goBack();
    await expect(page).toHaveURL(/\/en\/sign-in$/);
    await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
    await page.goForward();
    await expect(page.getByRole('heading', { name: 'Log in with phone' })).toBeVisible();
    // A code step without a sent code (reload / deep link) goes back to the page's first step.
    await page.goto('/en/sign-in?step=new-password&next=%2Fcart');
    await expect(page).toHaveURL(/\/en\/sign-in\?next=%2Fcart$/);
    await page.goto('/en/sign-up?step=verify');
    await expect(page).toHaveURL(/\/en\/sign-up$/);
  });
});

test.describe('Create your account (/sign-up)', () => {
  test('sign up by email, verify the code, land home', async ({ page }) => {
    watchCodes(page);
    const errors = trackErrors(page);
    const email = uniqueEmail('new');
    await page.goto('/en/sign-up');
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    await expect(page.getByText(/By creating an account, you agree to/)).toHaveCount(1);
    await page.getByLabel('Full name').fill('Sok Dara');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Create a password', { exact: true }).fill('Bright#2026');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/en\/sign-up\?step=verify$/);
    await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open Gmail' })).toBeVisible();
    await fillDemoCode(page);
    await expect(page).toHaveURL(/\/en\/home$/);
    expect(await storedEmail(page)).toBe(email);
    expect(errors).toEqual([]);
  });

  test('existing email offers "Log in instead"', async ({ page }) => {
    await page.goto('/en/sign-up?next=%2Fcart');
    await page.getByLabel('Full name').fill('Kry Sonita');
    await page.getByLabel('Email').fill(DEMO.email);
    await page.getByLabel('Create a password', { exact: true }).fill('Bright#2026');
    await page.getByRole('button', { name: 'Create account' }).click();
    const err = page.locator('#e-email');
    await expect(err).toContainText('An account already uses this email.');
    await err.getByRole('link', { name: 'Log in instead' }).click();
    await expect(page).toHaveURL(/\/en\/sign-in\?/);
    const url = new URL(page.url());
    expect(url.searchParams.get('email')).toBe(DEMO.email);
    expect(url.searchParams.get('next')).toBe('/cart');
    await expect(page.getByLabel('Email')).toHaveValue(DEMO.email);
    await page.getByLabel('Password', { exact: true }).fill(DEMO.password);
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(page).toHaveURL(/\/en\/cart$/);
  });

  test('bottom links switch pages and carry next + email', async ({ page }) => {
    await page.goto('/en/sign-in?next=%2Fseller');
    await page.getByLabel('Email').fill('dara@example.com');
    await page.getByRole('link', { name: 'Create an account' }).click();
    await expect(page).toHaveURL(/\/en\/sign-up\?/);
    expect(new URL(page.url()).searchParams.get('next')).toBe('/seller');
    await expect(page.getByLabel('Email')).toHaveValue('dara@example.com');
    await page.getByRole('link', { name: 'Log in', exact: true }).click();
    await expect(page).toHaveURL(/\/en\/sign-in\?/);
    expect(new URL(page.url()).searchParams.get('next')).toBe('/seller');
    await expect(page.getByLabel('Email')).toHaveValue('dara@example.com');
  });

  test('phone: new number, code, name, signed in (next honoured)', async ({ page }) => {
    watchCodes(page);
    const phone = `011${String(Date.now()).slice(-6)}`;
    await page.goto('/en/sign-up?next=%2Fcart');
    await page.getByRole('button', { name: 'Sign up with phone number' }).click();
    await expect(page).toHaveURL(/step=phone&next=%2Fcart|next=%2Fcart.*step=phone|step=phone/);
    await page.getByLabel('Mobile number').fill(phone);
    await page.getByRole('button', { name: 'Send code' }).click();
    await expect(page).toHaveURL(/step=phone-code/);
    await fillDemoCode(page);
    await expect(page).toHaveURL(/step=phone-name/);
    await expect(page.getByRole('heading', { name: 'Almost done' })).toBeVisible();
    await page.getByLabel('Full name').fill('Sok Dara');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/en\/cart$/);
    expect(await storedEmail(page)).toBe(phone);
  });

  test('phone: a known number on sign-up just signs in', async ({ page }) => {
    watchCodes(page);
    await page.goto('/en/sign-up');
    await page.getByRole('button', { name: 'Sign up with phone number' }).click();
    await page.getByLabel('Mobile number').fill('012 345 678');
    await page.getByRole('button', { name: 'Send code' }).click();
    await fillDemoCode(page);
    await expect(page).toHaveURL(/\/en\/home$/);
    expect(await storedEmail(page)).toBe('dom@virtualbiz.com');
  });

  test('Google: choose a demo account', async ({ page }) => {
    await page.goto('/en/sign-in');
    await page.getByRole('button', { name: 'Continue with Google' }).click();
    await expect(page).toHaveURL(/step=google/);
    const sheet = page.getByRole('dialog', { name: 'Choose an account' });
    await expect(sheet).toContainText('to continue to VirtualBiz');
    await expect(sheet).toContainText('nita@virtualbiz.com');
    await sheet.getByRole('button', { name: /Dom Chheng/ }).click();
    await expect(page).toHaveURL(/\/en\/home$/);
    expect(await storedEmail(page)).toBe('dom@virtualbiz.com');
  });

  test('Google: use another account creates it', async ({ page }) => {
    const email = `dara.${Date.now().toString(36)}@gmail.com`;
    await page.goto('/en/sign-up?next=%2Fcart');
    await page.getByRole('button', { name: 'Sign up with Google' }).click();
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('button', { name: 'Use another account' }).click();
    await expect(page).toHaveURL(/step=google-new/);
    await sheet.getByLabel('Full name').fill('Sok Dara');
    await sheet.getByLabel('Gmail address').fill(email);
    await sheet.getByRole('button', { name: 'Continue' }).click();
    await expect(page).toHaveURL(/\/en\/cart$/);
    expect(await storedEmail(page)).toBe(email);
  });

  test('Escape closes the Google chooser', async ({ page }) => {
    await page.goto('/en/sign-up');
    await page.getByRole('button', { name: 'Sign up with Google' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL(/\/en\/sign-up$/);
  });
});

test.describe('Cross links', () => {
  test('landing nav has "Sign up" next to "Log in"', async ({ page }) => {
    await page.goto('/en');
    await page.getByRole('banner').getByRole('link', { name: 'Sign up' }).click();
    await expect(page).toHaveURL(/\/en\/sign-up$/);
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  });

  test('create-business sends signed-out visitors to sign-up and back', async ({ page }) => {
    watchCodes(page);
    await page.goto('/en/create-business');
    await expect(page).toHaveURL(/\/en\/sign-up\?next=(%2F|\/)create-business$/);
    await page.getByLabel('Full name').fill('Sok Dara');
    await page.getByLabel('Email').fill(uniqueEmail('shop'));
    await page.getByLabel('Create a password', { exact: true }).fill('Bright#2026');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/step=verify/);
    await fillDemoCode(page);
    await expect(page).toHaveURL(/\/en\/create-business(\?|$)/);
  });

  test('customer login sheet links to sign-up with next', async ({ page }) => {
    await page.goto('/en/p/latte');
    await page
      .getByRole('button', { name: /add to cart/i })
      .first()
      .click();
    await page.goto('/en/cart');
    await page.getByRole('button', { name: /check out/i }).click();
    await page.getByRole('link', { name: 'Create an account' }).click();
    await expect(page).toHaveURL(/\/en\/sign-up\?next=%2Fcart$/);
  });

  test('signed-in visits to /sign-in and /sign-up redirect', async ({ page }) => {
    await signIn(page, '/home');
    await page.goto('/en/sign-up');
    await expect(page).toHaveURL(/\/en\/home$/);
    await page.goto('/en/sign-up?next=%2Fcart');
    await expect(page).toHaveURL(/\/en\/cart$/);
  });
});
