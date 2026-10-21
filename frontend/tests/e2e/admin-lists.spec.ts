import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { signIn, trackErrors, type Account } from './_helpers/app';

const ADMIN: Account = { email: 'admin@virtualbiz.com', password: 'Demo@1234' };

// Phase 15 (docs/api/phase15-lists.md): console lists sort on the server, filter by date and
// more, page with a size choice, export what they show and act on many rows at once.
test.describe('Console lists', () => {
  test('orders sort by total, filter by fulfilment and page size, all kept in the URL', async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await signIn(page, '/admin/orders', ADMIN);
    const table = page.getByRole('table', { name: 'Orders' });
    await expect(table.locator('tbody tr').first()).toBeVisible({ timeout: 20_000 });

    await table.getByRole('button', { name: /Total/ }).click();
    await expect(page).toHaveURL(/sort=-total/);
    await expect(table.getByRole('columnheader', { name: /Total/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    const totals = await table
      .locator('tbody tr td:nth-child(7)')
      .allInnerTexts()
      .then((xs) => xs.map((x) => Number(x.replace(/[^0-9.]/g, ''))));
    expect(totals).toEqual([...totals].sort((a, b) => b - a));

    await page.getByLabel('Fulfilment').selectOption('PICKUP');
    await expect(page).toHaveURL(/method=PICKUP/);
    await expect(page.getByText('Fulfilment: Pickup')).toBeVisible();
    await expect(table.locator('tbody tr').first()).toContainText('Pickup');

    await page.getByLabel('Rows per page').selectOption('10');
    await expect(page).toHaveURL(/size=10/);
    expect(await table.locator('tbody tr').count()).toBeLessThanOrEqual(10);

    await page.reload();
    await expect(page.getByText('Fulfilment: Pickup')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Remove filter Fulfilment: Pickup' }).click();
    await expect(page).not.toHaveURL(/method=/);
    expect(errors).toEqual([]);
  });

  test('a filtered list downloads as CSV and the export is audited', async ({ page }) => {
    await signIn(page, '/admin/orders?method=PICKUP', ADMIN);
    await expect(page.getByText('Fulfilment: Pickup')).toBeVisible({ timeout: 20_000 });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export CSV' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^virtualbiz-orders-\d{4}-\d\d-\d\d\.csv$/);
    const csv = readFileSync((await download.path())!, 'utf8');
    expect(csv.startsWith('﻿"Order","Placed"')).toBe(true);
    for (const line of csv.trim().split('\r\n').slice(1)) expect(line).toContain('"PICKUP"');

    await page.goto('/en/admin/audit?targetType=EXPORT');
    await expect(page.locator('section').getByText('Exported a list').first()).toBeVisible();
  });

  test('reviews: select several, hide them with one reason, then show them again', async ({
    page,
  }) => {
    await signIn(page, '/admin/reviews?status=visible', ADMIN);
    const table = page.getByRole('table', { name: 'Reviews' });
    await expect(table.locator('tbody tr').first()).toBeVisible({ timeout: 20_000 });
    const boxes = table.getByRole('checkbox', { name: 'Select row' });
    await boxes.nth(0).check();
    await boxes.nth(1).check();
    const bar = page.getByRole('toolbar', { name: 'Actions for selected rows' });
    await expect(bar).toContainText('2 selected');

    await bar.getByRole('button', { name: 'Hide' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Hide 2 reviews?');
    await dialog.getByRole('textbox').fill('Spam from one account');
    await dialog.getByRole('button', { name: 'Hide' }).click();
    await expect(page.getByText('Done for 2 rows.')).toBeVisible();

    await page.goto('/en/admin/reviews?status=hidden');
    await expect(table.locator('tbody tr').first()).toBeVisible({ timeout: 20_000 });
    await table.getByRole('checkbox', { name: 'Select all on this page' }).check();
    await page
      .getByRole('toolbar', { name: 'Actions for selected rows' })
      .getByRole('button', { name: 'Show again' })
      .click();
    await page.getByRole('dialog').getByRole('button', { name: 'Show again' }).click();
    await expect(page.getByText(/Done for \d+ rows?\./)).toBeVisible();
  });
});
