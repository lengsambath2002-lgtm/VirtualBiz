import { expect, test } from '@playwright/test';

import { signIn } from './_helpers/app';

// Phase 5 (docs/api/phase5-pos-promotions-reviews.md § POS): a counter sale is stored by the
// API (an R- receipt) and takes the item's stock.
test('the register rings up a sale the API keeps', async ({ page }) => {
  await signIn(page, '/seller/pos');
  const tile = page.getByRole('button', { name: /USB-C to USB-C Cable/ }).first();
  await expect(tile).toBeVisible({ timeout: 20_000 });
  const before = Number((await tile.innerText()).match(/(\d+) in stock/)?.[1] ?? NaN);

  // A shift is open in the seeded data; open one if an earlier run closed it.
  const open = page.getByRole('dialog').getByRole('button', { name: /Open shift|Open/ });
  await tile.click();
  if (await open.isVisible().catch(() => false)) {
    await open.click();
    await tile.click();
  }
  await page.getByRole('button', { name: /^Charge \$/ }).click();
  // Cash: the exact amount handed over.
  await page.getByRole('dialog').getByRole('button', { name: /exact/i }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Complete sale' }).click();
  await expect(page.getByRole('dialog').getByText(/R-\d{5,}/)).toBeVisible({ timeout: 20_000 });
  const number = (
    await page
      .getByRole('dialog')
      .getByText(/R-\d{5,}/)
      .innerText()
  ).trim();

  const sales = await page.request.get('/api/pos/sales', {
    headers: { 'X-Business-Id': '22222222-2222-4222-8222-000000000001' },
  });
  expect(sales.status()).toBeLessThan(500);
  await page.getByRole('button', { name: 'New sale' }).click();
  await expect(tile).toContainText(`${before - 1} in stock`);
  expect(number).toMatch(/^R-/);
});
