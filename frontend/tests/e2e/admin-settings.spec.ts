import { expect as baseExpect, test } from '@playwright/test';

import { signIn, trackErrors, type Account } from './_helpers/app';

const expect = baseExpect.configure({ timeout: 20_000 });
const ADMIN: Account = { email: 'admin@virtualbiz.com', password: 'Demo@1234' };

test.describe('Super-admin settings', () => {
  test('a category added in the console shows in the marketplace in both languages, until hidden', async ({
    page,
  }) => {
    const errors = trackErrors(page);
    const name = `Bikes ${Date.now().toString(36)}`;
    await signIn(page, '/admin/settings?tab=categories', ADMIN);
    const products = page.getByRole('region').or(page.locator('section')).filter({
      hasText: 'Product shop categories',
    });
    await products.getByRole('button', { name: 'Add category' }).click();
    const dialog = page.getByRole('dialog', { name: 'New category' });
    await dialog.getByRole('button', { name: 'Add category' }).click();
    await expect(dialog.getByText('Enter 2–40 characters.').first()).toBeVisible();
    await dialog.getByLabel('Name (English)').fill(name);
    await dialog.getByLabel('Name (Khmer)').fill('កង់');
    await dialog.getByRole('button', { name: 'truck' }).click();
    await dialog.getByRole('button', { name: 'Add category' }).click();
    await expect(page.getByText(`${name} added`)).toBeVisible();
    const row = page.getByRole('row', { name: new RegExp(name) });
    await expect(row).toContainText('Shown');

    // The marketplace reads categories from the API: English and Khmer names, no deploy.
    const shop = await page.context().newPage();
    await shop.goto('/en/home');
    await expect(shop.getByRole('link', { name, exact: true }).first()).toBeVisible();
    await shop.goto('/kh/home');
    await expect(shop.getByRole('link', { name: 'កង់', exact: true }).first()).toBeVisible();

    // Hidden: gone from the marketplace bar.
    await row.getByRole('checkbox', { name: `Show ${name} in the marketplace` }).click();
    await expect(page.getByText(`${name} is hidden from the marketplace`)).toBeVisible();
    await shop.goto('/en/home');
    await expect(
      shop.getByRole('link', { name: 'Electronics', exact: true }).first(),
    ).toBeVisible();
    await expect(shop.getByRole('link', { name, exact: true })).toHaveCount(0);

    // Every change is in the audit log.
    await page.goto('/en/admin/audit?targetType=CATEGORY');
    await expect(page.locator('section').getByText('Added a category').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('changing the riel rate asks first, saves, and is audited with old and new values', async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await signIn(page, '/admin/settings', ADMIN);
    const rate = page.getByLabel('Riel exchange rate');
    await expect(rate).toHaveValue(/\d{4}/);
    const was = await rate.inputValue();
    const next = was === '4000' ? '4050' : '4000';
    await rate.fill(next);
    await expect(
      page.getByText(`$1.00 shows as ${Number(next).toLocaleString('en-US')} KHR`),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Save changes' }).click();
    const confirm = page.getByRole('dialog');
    await expect(confirm).toContainText('Riel rate:');
    await confirm.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible();
    await expect(page.getByText(/Last changed by Sok Vanna/)).toBeVisible();

    const pub = await page.request.get('/api/meta/settings');
    expect((await pub.json()).data.khrPerUsd).toBe(Number(next));

    await page.goto('/en/admin/audit?targetType=SETTINGS');
    await expect(
      page.locator('section').getByText('Changed the platform settings').first(),
    ).toBeVisible();
    await expect(page.getByText(/Riel rate: .* → .* KHR/).first()).toBeVisible();

    // Put it back.
    await page.goto('/en/admin/settings');
    await page.getByLabel('Riel exchange rate').fill(was);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('the overview switches period and links each queue to its list', async ({ page }) => {
    const errors = trackErrors(page);
    await signIn(page, '/admin', ADMIN);
    await expect(page.getByText('vs previous 30 days').first()).toBeVisible();
    await page.getByRole('button', { name: '7 days' }).click();
    await expect(page).toHaveURL(/range=7/);
    await expect(page.getByText('vs previous 7 days').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Top shops, 7 days' })).toBeVisible();
    await page.getByRole('button', { name: 'Orders', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Orders per day' })).toBeVisible();
    await page.getByRole('link', { name: /Suspended accounts/ }).click();
    await expect(page).toHaveURL(/\/admin\/users\?status=suspended/);
    expect(errors).toEqual([]);
  });
});
