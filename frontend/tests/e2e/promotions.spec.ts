import { expect, test } from '@playwright/test';

import { signIn } from './_helpers/app';

// A promotion runs through its end date and ends by itself afterwards: one that ends today is
// still active today (it used to stop at the start of its last day).
test('a promotion ending today is still active today', async ({ page }) => {
  await signIn(page, '/seller/promotions');
  await page.getByRole('button', { name: 'Create promotion' }).click();
  const name = `Last day ${Date.now().toString(36)}`;
  const today = new Intl.DateTimeFormat('en-CA').format(new Date());
  await page.getByLabel('Name (only you see this)').fill(name);
  await page.getByRole('radio', { name: 'Automatic' }).check();
  await page.getByLabel('Value').fill('10');
  await page.getByLabel('Starts').fill(today);
  await page.getByLabel('Ends').fill(today);
  await expect(
    page.getByText('It runs through this day and ends by itself at midnight.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Create', exact: true }).click();

  const row = page.getByRole('row').filter({ hasText: name });
  await expect(row).toContainText('Active', { timeout: 20_000 });
  await expect(row).not.toContainText('Ended');
  // End it now so the demo shop's list stays clean.
  await row.getByRole('button', { name: /End/ }).click();
  await expect(row).toContainText('Ended');
});
