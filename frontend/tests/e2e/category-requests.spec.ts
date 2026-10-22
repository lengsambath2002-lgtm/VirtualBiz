import { expect, test } from '@playwright/test';

import { DANA, signIn, type Account } from './_helpers/app';

const ADMIN: Account = { email: 'admin@virtualbiz.com', password: 'Demo@1234' };

// Phase 19 (docs/api/phase19-category-requests.md): a shop suggests a marketplace category,
// VirtualBiz decides.
test('a salon suggests a category; a super-admin approves it as an existing one', async ({
  page,
  browser,
}) => {
  await signIn(page, '/provider/settings', DANA);
  const panel = page.getByRole('region', { name: 'Marketplace category' });
  await expect(panel).toBeVisible({ timeout: 20_000 });
  // An earlier run may have left one waiting: withdraw it first.
  const old = panel.getByRole('button', { name: 'Withdraw' });
  if (await old.isVisible().catch(() => false)) await old.click();
  const name = `Brow bar ${Date.now().toString(36)}`;
  await panel.getByRole('button', { name: 'Suggest a category' }).click();
  await panel.getByLabel('Category name').fill(name);
  await panel.getByLabel(/Why is it needed/).fill('We only do brows and lashes');
  await panel.getByRole('button', { name: 'Send suggestion' }).click();
  await expect(panel.getByText(name)).toBeVisible();
  await expect(panel.getByText('Waiting')).toBeVisible();

  const admin = await (await browser.newContext()).newPage();
  await signIn(admin, '/admin/settings?tab=categories', ADMIN);
  const row = admin.getByRole('row').filter({ hasText: name });
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.getByRole('button', { name: 'Approve' }).click();
  const dialog = admin.getByRole('dialog');
  await dialog.getByRole('combobox').first().selectOption({ label: 'Existing: Spa' });
  await dialog.getByRole('button', { name: 'Approve' }).click();
  await expect(admin.getByText(`“${name}” approved; the shop was told.`)).toBeVisible();
  await admin.close();

  await page.reload();
  await expect(panel.getByRole('listitem').filter({ hasText: name })).toContainText('Approved', {
    timeout: 20_000,
  });
  const select = panel.getByRole('combobox', { name: 'Category' });
  try {
    await expect(select).toHaveValue('spa');
  } finally {
    // Back to where the demo salon belongs (also when the check above fails), with the panel's save.
    await page.reload();
    await select.selectOption('beauty');
    await panel.getByRole('button', { name: 'Save' }).click();
    await expect(panel.getByText('Category saved.')).toBeVisible();
  }
});
