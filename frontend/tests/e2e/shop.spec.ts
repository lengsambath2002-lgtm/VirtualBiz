import { expect, test } from '@playwright/test';

import { fillDemoCode, watchCodes, forgetSession, trackErrors } from './_helpers/app';

test.describe('Customer marketplace', () => {
  test('add a product to the cart while signed out @phone', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/en/p/latte');
    await page
      .getByRole('button', { name: /add to cart/i })
      .first()
      .click();
    await page.goto('/en/cart');
    await expect(page.getByText('Iced Mondulkiri Latte')).toBeVisible();
    await expect(page.getByRole('button', { name: /check out/i })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('checkout asks a signed-out customer to log in', async ({ page }) => {
    await page.goto('/en/p/latte');
    await page
      .getByRole('button', { name: /add to cart/i })
      .first()
      .click();
    await page.goto('/en/cart');
    await page.getByRole('button', { name: /check out/i }).click();
    await expect(page.locator('input[type=password]')).toBeVisible();
  });
});

test.describe('Login sheet', () => {
  const sheet = (page: import('@playwright/test').Page) => page.getByRole('dialog');

  async function openSheet(page: import('@playwright/test').Page) {
    await page.goto('/en/p/latte');
    await page
      .getByRole('button', { name: /add to cart/i })
      .first()
      .click();
    await page.goto('/en/cart');
    await page.getByRole('button', { name: /check out/i }).click();
    await expect(sheet(page)).toBeVisible();
  }

  async function sheetLogin(page: import('@playwright/test').Page, email: string, pw: string) {
    await sheet(page).getByLabel('Email').fill(email);
    await sheet(page).getByLabel('Password').fill(pw);
    await sheet(page).getByRole('button', { name: 'Log in', exact: true }).click();
  }

  test('logs in an account created on /sign-up', async ({ page }) => {
    watchCodes(page);
    const email = `sheet-${Date.now()}@example.com`;
    await page.goto('/en/sign-up');
    await page.getByLabel('Full name').fill('Sok Dara');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Create a password', { exact: true }).fill('Bright#2026');
    await page.getByRole('button', { name: 'Create account' }).click();
    await fillDemoCode(page);
    await expect(page).toHaveURL(/\/en\/home$/, { timeout: 20_000 });
    // Sign out on this browser (the account stays on the server).
    await forgetSession(page);

    await openSheet(page);
    await sheetLogin(page, email, 'Wrong#2026');
    await expect(sheet(page)).toContainText('Email or password is incorrect.');
    await sheetLogin(page, email, 'Bright#2026');
    // Signed in: the login sheet closes. A new account has no address yet, so checkout
    // continues straight into "Add address".
    await expect(page.getByRole('dialog', { name: /^Log in/ })).toBeHidden();
    await expect(page.getByRole('dialog', { name: 'Add address' })).toBeVisible();
    const stored = await page.evaluate(
      () => JSON.parse(localStorage.getItem('vb-session') ?? '{}').state?.user?.email,
    );
    expect(stored).toBe(email);
  });

  test('says when no account uses the email', async ({ page }) => {
    await openSheet(page);
    await sheetLogin(page, `nobody-${Date.now()}@example.com`, 'Whatever#1');
    await expect(sheet(page)).toContainText('No account uses this email.');
  });
});
