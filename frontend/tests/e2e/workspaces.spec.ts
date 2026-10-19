import { expect, test } from '@playwright/test';

import { DANA, signIn, trackErrors } from './_helpers/app';

test.describe('Business workspaces', () => {
  test('seller POS register opens with the shop products', async ({ page }) => {
    await signIn(page, '/seller/pos');
    await expect(page.getByRole('heading', { name: 'Register' })).toBeVisible();
    await expect(page.getByText('iPhone 15').first()).toBeVisible();
  });

  test('provider opens on the staff calendar', async ({ page }) => {
    await signIn(page, '/provider', DANA);
    await expect(page).toHaveURL(/\/en\/provider\/calendar/);
    await expect(page.getByText('Try Dana').filter({ visible: true }).first()).toBeVisible();
  });
});

/** Pages Kry Sonita (customer + Nita Gadget Store) opens. */
const ROUTES = [
  '/en',
  '/kh',
  '/en/home',
  '/en/search?q=latte',
  '/en/deals',
  '/en/cart',
  '/en/checkout',
  '/en/account/orders',
  '/en/account/bookings',
  '/en/account/profile',
  '/en/help',
  '/en/create-business',
  '/en/seller',
  '/en/seller/pos',
  '/en/seller/orders',
  '/en/seller/products',
  '/en/seller/products/new',
  '/en/seller/inventory',
  '/en/seller/promotions',
  '/en/seller/customers',
  '/en/seller/reviews',
  '/en/seller/settings',
  '/kh/home',
  '/kh/seller',
];

/** Pages Try Dana (Glow Beauty Salon) opens. */
const PROVIDER_ROUTES = [
  '/en/provider/calendar',
  '/en/provider/sales',
  '/en/provider/clients',
  '/en/provider/services',
  '/en/provider/team',
  '/en/provider/marketing',
  '/en/provider/settings',
  '/kh/provider/calendar',
];

test('every page loads without errors when signed in', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await signIn(page, '/home');
  for (const route of ROUTES) {
    const res = await page.goto(route);
    expect(res?.status(), route).toBe(200);
    // Not 'networkidle': signed-in pages keep the live-update stream open.
    await page.waitForLoadState('load');
    await page.waitForTimeout(1500);
  }
  expect(errors).toEqual([]);
});

test('every provider page loads without errors', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await signIn(page, '/home', DANA);
  for (const route of PROVIDER_ROUTES) {
    const res = await page.goto(route);
    expect(res?.status(), route).toBe(200);
    // Not 'networkidle': signed-in pages keep the live-update stream open.
    await page.waitForLoadState('load');
    await page.waitForTimeout(1500);
  }
  expect(errors).toEqual([]);
});
