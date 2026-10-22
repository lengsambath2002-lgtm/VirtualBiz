import { expect, test } from '@playwright/test';

import { DANA, signIn } from './_helpers/app';

// Phase 18 (docs/api/phase18-shop-activity.md): owners see who did what in their shop.
test.describe('Shop activity log', () => {
  test('a change shows in the log, found through the team page and filters', async ({ page }) => {
    await signIn(page, '/provider/clients', DANA);
    await page.getByRole('button', { name: 'Add customer' }).click();
    const name = `Logged ${Date.now().toString(36)}`;
    const dialog = page.getByRole('dialog', { name: 'New customer' });
    await dialog.getByLabel('Name').fill(name);
    await dialog.getByLabel('Phone').fill(`09${String(Date.now()).slice(-7)}`);
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog).toBeHidden();

    await page.goto('/en/provider/team');
    await page.getByRole('link', { name: 'Activity log' }).click();
    await expect(page).toHaveURL(/\/provider\/activity/);
    const table = page.getByRole('table', { name: 'Activity log' });
    await expect(table.getByText(name)).toBeVisible({ timeout: 20_000 });
    await expect(table.getByText('Added a customer').first()).toBeVisible();

    await page.getByRole('combobox', { name: 'About' }).selectOption('CUSTOMER');
    await expect(page).toHaveURL(/targetType=CUSTOMER/);
    await expect(table.locator('tbody tr').first()).toContainText(/customer/i);
  });
});
