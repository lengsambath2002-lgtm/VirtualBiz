import { expect, test } from '@playwright/test';

import { DANA, signIn } from './_helpers/app';

// Phase 17 (docs/api/phase17-more-lists.md): stock history, the whole inbox, saved views.
test.describe('More lists', () => {
  test('stock history filters by direction and reason, all on the server', async ({ page }) => {
    await signIn(page, '/seller/inventory');
    const panel = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Stock history' }) });
    await expect(panel.getByRole('navigation', { name: 'Pages' })).toContainText(/of \d+/, {
      timeout: 20_000,
    });
    await panel.getByRole('tab', { name: 'Stock out' }).click();
    await expect(page).toHaveURL(/direction=out/);
    await expect(panel.locator('tbody tr').first()).toContainText('−');
    await panel.getByRole('combobox', { name: /^Reason/ }).selectOption('POS_SALE');
    await expect(page).toHaveURL(/reason=POS_SALE/);
  });

  test('the bell links to the whole inbox, which pages and filters unread', async ({ page }) => {
    await signIn(page, '/provider/calendar', DANA);
    await page
      .getByRole('button', { name: /Notifications/ })
      .first()
      .click();
    await page.getByRole('button', { name: 'See all notifications' }).click();
    await expect(page).toHaveURL(/\/provider\/notifications/);
    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Pages' })).toContainText(/of \d+/, {
      timeout: 20_000,
    });
    await page.getByRole('tab', { name: 'Unread' }).click();
    await expect(page).toHaveURL(/unread=true/);
  });

  test('a saved view brings its filters back', async ({ page }) => {
    await signIn(page, '/admin/orders?method=PICKUP&status=open', {
      email: 'admin@virtualbiz.com',
      password: 'Demo@1234',
    });
    await expect(page.getByText('Fulfilment: Pickup')).toBeVisible({ timeout: 20_000 });
    const name = `Pickups ${Date.now().toString(36)}`;
    await page.getByRole('button', { name: 'Save view' }).click();
    await page.getByRole('textbox', { name: 'View name' }).fill(name);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('combobox', { name: /^View/ })).toHaveValue(/.+/);

    await page.goto('/en/admin/orders');
    await page.getByRole('combobox', { name: /^View/ }).selectOption({ label: name });
    await expect(page).toHaveURL(/method=PICKUP/);
    await expect(page.getByText('Fulfilment: Pickup')).toBeVisible();
    await page.getByRole('button', { name: 'Delete view' }).click();
    await expect(page.getByRole('button', { name: 'Save view' })).toBeVisible();
  });
});
