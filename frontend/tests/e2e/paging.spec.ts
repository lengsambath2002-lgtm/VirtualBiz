import { expect, test } from '@playwright/test';

import { DANA, signIn } from './_helpers/app';

// Every list pages, 10 rows by default (docs/api/phase15-lists.md): the page and size are in the
// URL, so a reload keeps them; a new search goes back to the first page.
test.describe('Pagination everywhere', () => {
  test('seller products page through, keep the page on reload, and restart on search', async ({
    page,
  }) => {
    await signIn(page, '/seller/products');
    const pager = page.getByRole('navigation', { name: 'Pages' });
    await expect(pager).toContainText(/^1–10 of \d+/, { timeout: 20_000 });
    const rows = page.locator('table tbody tr');
    await expect(rows).toHaveCount(10);
    await pager.getByRole('button', { name: 'Next page' }).click();
    await expect(page).toHaveURL(/page=1/);
    await expect(pager).toContainText(/^11–/);
    await page.reload();
    await expect(page.getByRole('navigation', { name: 'Pages' })).toContainText(/^11–/, {
      timeout: 20_000,
    });
    await page.getByRole('searchbox').first().fill('iphone');
    await expect(page).not.toHaveURL(/page=/);
    await expect(page.getByRole('navigation', { name: 'Pages' })).toContainText(/^1–/);
  });

  test('the open order tabs show every order a page at a time', async ({ page }) => {
    await signIn(page, '/seller/orders?tab=pack');
    const pager = page.getByRole('navigation', { name: 'Pages' });
    await expect(pager).toContainText(/of \d+/, { timeout: 20_000 });
    const total = Number((await pager.textContent())!.match(/of ([\d,]+)/)![1]!.replace(',', ''));
    const tab = page.getByRole('tab', { name: /To pack/ });
    await expect(tab).toContainText(String(total));
  });

  test('provider services and reviews page too', async ({ page }) => {
    await signIn(page, '/provider/services', DANA);
    await expect(page.getByRole('navigation', { name: 'Pages' }).first()).toContainText(/of \d+/, {
      timeout: 20_000,
    });
    await page.goto('/en/provider/marketing?tab=reviews');
    await expect(page.getByRole('navigation', { name: 'Pages' })).toContainText(/of \d+/, {
      timeout: 20_000,
    });
  });
});
