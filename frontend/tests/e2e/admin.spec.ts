import { expect as baseExpect, type APIRequestContext, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import {
  createAccount,
  fillLogin,
  forgetSession,
  signIn,
  trackErrors,
  type Account,
} from './_helpers/app';

const expect = baseExpect.configure({ timeout: 20_000 });
const ADMIN: Account = { email: 'admin@virtualbiz.com', password: 'Demo@1234' };
const ID_PHOTO = path.join(__dirname, '_helpers/id-card.png');

/** A fresh account with a new product shop waiting for its ID check. */
async function pendingShop(request: APIRequestContext, name: string) {
  const owner = await createAccount(request, 'Sok Owner');
  const login = await request.post('/api/auth/login', { data: owner });
  const token = (await login.json()).data.accessToken as string;
  const idPhoto = `data:image/png;base64,${fs.readFileSync(ID_PHOTO).toString('base64')}`;
  const res = await request.post('/api/businesses', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      type: 'PRODUCT',
      name,
      categoryId: 'electronics',
      district: 'BKK1',
      street: '#12, St. 516',
      phone: '012345678',
      hours: { open: '08:00', close: '20:00', sunday: true },
      idPhoto,
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
  return { owner, id: (await res.json()).data.id as string };
}

test.describe('Super-admin console', () => {
  test('is for staff only', async ({ page }) => {
    await signIn(page, '/home');
    await page.goto('/en/admin');
    await expect(page.getByRole('heading', { name: 'Staff only' })).toBeVisible();
  });

  test('checks a new shop’s ID: reject with a reason the owner sees, then verify', async ({
    page,
    browser,
    request,
  }) => {
    const errors = trackErrors(page);
    const name = `Sok Gadgets ${Date.now().toString(36)}`;
    const shop = await pendingShop(request, name);

    await signIn(page, '/admin', ADMIN);
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await page.getByRole('link', { name: /Shops waiting for an ID check/ }).click();
    await expect(page).toHaveURL(/verification=PENDING/);
    await page.getByRole('searchbox', { name: 'Search shops' }).fill(name);
    await expect(page.getByText('1 business', { exact: true })).toBeVisible();
    await page.getByRole('cell', { name: new RegExp(name) }).click();
    await expect(page.getByRole('heading', { name })).toBeVisible();
    await page.getByRole('button', { name: 'Show ID photo' }).click();
    await expect(page.getByRole('img', { name: "The owner's ID card" })).toBeVisible();

    await page.getByRole('button', { name: 'Reject ID' }).click();
    await page.getByLabel("What's wrong (the owner sees this)").fill('The photo is blurry');
    await page.getByRole('dialog').getByRole('button', { name: 'Reject ID' }).click();
    await expect(page.getByText('ID rejected. The owner has been told why.')).toBeVisible();
    await expect(page.getByText('Rejected: The photo is blurry')).toBeVisible();
    await expect(page.getByText("Rejected a shop's ID")).toBeVisible();

    // The owner's workspace says why and how to fix it.
    const ownerCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    await signIn(ownerPage, '/seller/settings', shop.owner);
    await expect(ownerPage.getByText('Your ID check did not pass').first()).toBeVisible();
    await expect(ownerPage.getByText(/The photo is blurry/).first()).toBeVisible();
    await expect(ownerPage.getByText('Send a new ID photo').first()).toBeVisible();
    await ownerCtx.close();

    await page.getByRole('button', { name: 'Verify ID' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Verify ID' }).click();
    await expect(page.getByText('Shop verified. The owner has been told.')).toBeVisible();
    await expect(page.getByText('Verified', { exact: true }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('suspending an account stops its sign-in; reinstating lets it back', async ({
    page,
    request,
  }) => {
    const account = await createAccount(request, 'Bad Actor');
    await signIn(page, '/admin/users', ADMIN);
    await page.getByRole('searchbox', { name: 'Search accounts' }).fill(account.email);
    await expect(page.getByText('1 account', { exact: true })).toBeVisible();
    await page.getByRole('cell', { name: /Bad Actor/ }).click();
    await expect(page.getByRole('heading', { name: 'Bad Actor' })).toBeVisible();
    await page.getByRole('button', { name: 'Suspend', exact: true }).click();
    await page.getByLabel('Reason (they will see it)').fill('Fake orders');
    await page.getByRole('dialog').getByRole('button', { name: 'Suspend', exact: true }).click();
    await expect(page.getByText('Account suspended and signed out everywhere.')).toBeVisible();
    await expect(page.getByText('Fake orders').first()).toBeVisible();

    await forgetSession(page);
    await page.goto('/en/sign-in');
    await fillLogin(page, account.email, account.password);
    await expect(
      page.getByText('This account is suspended. Contact VirtualBiz support for help.'),
    ).toBeVisible();

    await signIn(page, '/admin/users', ADMIN);
    await page.getByRole('searchbox', { name: 'Search accounts' }).fill(account.email);
    await expect(page.getByText('1 account', { exact: true })).toBeVisible();
    await page.getByRole('cell', { name: /Bad Actor/ }).click();
    await page.getByRole('button', { name: 'Reinstate', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Reinstate' }).click();
    await expect(page.getByText('Account reinstated. They can sign in again.')).toBeVisible();
  });

  test('every console page loads without errors', async ({ page }) => {
    const errors = trackErrors(page);
    await signIn(page, '/admin', ADMIN);
    for (const p of [
      'shops',
      'users',
      'orders',
      'reviews',
      'promos',
      'payouts',
      'payouts?view=history',
      'audit',
    ]) {
      await page.goto(`/en/admin/${p}`);
      await expect(page.locator('h1').first()).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
});
