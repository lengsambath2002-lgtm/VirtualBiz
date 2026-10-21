import { expect, test } from '@playwright/test';

import { DANA, signIn } from './_helpers/app';

// Phase 16 (docs/api/phase16-shop-lists.md): appointments as a list, every sale and every receipt.
test.describe('History lists', () => {
  test('the calendar list filters appointments and opens one', async ({ page }) => {
    await signIn(page, '/provider/calendar?view=list', DANA);
    const table = page.getByRole('table', { name: 'Appointments' });
    await expect(table.locator('tbody tr[tabindex="0"]').first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole('combobox', { name: /^Status/ }).selectOption('COMPLETED');
    await expect(page).toHaveURL(/status=COMPLETED/);
    await expect(table.locator('tbody tr[tabindex="0"]').first()).toContainText('Completed');
    await table.locator('tbody tr[tabindex="0"]').first().click();
    await expect(page.getByRole('dialog').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: 'Day' }).click();
    await expect(page).not.toHaveURL(/view=list/);
  });

  test('provider sales page through every sale with search', async ({ page }) => {
    await signIn(page, '/provider/sales', DANA);
    const table = page.getByRole('table', { name: 'Transactions' });
    await expect(table.locator('tbody tr[tabindex="0"]').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('navigation', { name: 'Pages' })).toContainText(/of \d+/);
    await table.getByRole('button', { name: /Total/ }).click();
    await expect(page).toHaveURL(/sort=-total/);
  });

  test('the register finds a receipt by number on any day', async ({ page }) => {
    await signIn(page, '/seller/pos');
    await page.getByRole('button', { name: 'Receipts', exact: true }).click();
    const dialog = page
      .getByRole('dialog')
      .filter({ has: page.getByRole('heading', { name: 'Receipts' }) });
    await dialog.getByRole('searchbox', { name: 'Search sales' }).fill('R-');
    const first = dialog
      .locator('button')
      .filter({ hasText: /R-\d{5,}/ })
      .first();
    await expect(first).toBeVisible({ timeout: 20_000 });
    const number = (await first.innerText()).match(/R-\d{5,}/)![0];
    await dialog.getByRole('searchbox', { name: 'Search sales' }).fill(number);
    await expect(dialog.locator('button').filter({ hasText: number })).toHaveCount(1);
    await dialog.locator('button').filter({ hasText: number }).click();
    await expect(page.getByRole('dialog').first()).toContainText(number);
  });
});
