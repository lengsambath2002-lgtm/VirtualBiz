import { expect, test } from '@playwright/test';

import { DANA, signIn } from './_helpers/app';

// Phase 16 (docs/api/phase16-shop-lists.md): shop lists page on the server, filter, sort,
// import and export.
test.describe('Shop lists', () => {
  test('order history reaches every order: filter, sort, page size, open one', async ({ page }) => {
    await signIn(page, '/seller/orders?tab=all');
    const table = page.getByRole('table', { name: 'Orders' });
    await expect(table.locator('tbody tr[tabindex="0"]').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('navigation', { name: 'Pages' })).toContainText(/of \d+/);

    await table.getByRole('button', { name: /Total/ }).click();
    await expect(page).toHaveURL(/sort=-total/);
    await page.getByRole('combobox', { name: /^Delivery/ }).selectOption('PICKUP');
    await expect(page.getByText('Delivery: Pickup')).toBeVisible();
    // 10 rows by default; more on request, kept in the URL.
    await expect.poll(() => table.locator('tbody tr').count()).toBeLessThanOrEqual(10);
    await page.getByLabel('Rows per page').selectOption('20');
    await expect(page).toHaveURL(/size=20/);
    await expect.poll(() => table.locator('tbody tr').count()).toBeLessThanOrEqual(20);

    const first = table.locator('tbody tr[tabindex="0"]').first();
    const number = (await first.locator('td').first().innerText()).match(/VB-\d+/)![0];
    await first.click();
    await expect(page.getByRole('dialog').first()).toContainText(number);
  });

  test('a product CSV is checked first, then imported', async ({ page }) => {
    await signIn(page, '/seller/products');
    await page.getByRole('button', { name: 'Import CSV' }).click();
    const sku = `E2E-${Date.now().toString(36)}`;
    const csv = [
      '"Product","SKU","Price (USD)","Stock","Collection"',
      `"E2E Imported Lamp ${sku}","${sku}","12.50","7","Accessories"`,
      `"Broken row","${sku}","abc","1",""`,
    ].join('\r\n');
    await page.getByTestId('import-file').setInputFiles({
      name: 'products.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });
    const dialog = page.getByRole('dialog', { name: 'Import products' });
    await expect(dialog.getByText('Problems')).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByRole('row', { name: /3.*Price \(USD\)/ })).toBeVisible();
    await dialog.getByRole('button', { name: /Import 1 good rows/ }).click();
    await expect(dialog.getByText(/Imported: 1 new/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Done' }).click();
    await page.getByRole('searchbox').first().fill(sku);
    await expect(page.getByText(`E2E Imported Lamp ${sku}`)).toBeVisible({ timeout: 20_000 });
  });

  test('a salon imports clients and filters its VIPs', async ({ page }) => {
    await signIn(page, '/provider/clients', DANA);
    await expect(page.getByRole('table', { name: 'Clients' })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Import CSV' }).click();
    const phone = `09${String(Date.now()).slice(-7)}`;
    await page.getByTestId('import-file').setInputFiles({
      name: 'clients.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(`Name,Phone,District\r\nNary E2E,${phone},Daun Penh\r\n`),
    });
    const dialog = page.getByRole('dialog', { name: 'Import customers' });
    await dialog.getByRole('button', { name: 'Import 1 rows' }).click();
    await expect(dialog.getByText(/Imported: 1 new/)).toBeVisible({ timeout: 20_000 });
    await dialog.getByRole('button', { name: 'Done' }).click();

    await page.getByRole('searchbox', { name: 'Search customers' }).fill(phone);
    const table = page.getByRole('table', { name: 'Clients' });
    await expect(table.getByText('Nary E2E')).toBeVisible({ timeout: 20_000 });
    await expect(table.getByText('New', { exact: true })).toBeVisible();

    await page.getByRole('searchbox', { name: 'Search customers' }).fill('');
    await page.getByRole('tab', { name: 'VIP' }).click();
    await expect(page).toHaveURL(/segment=vip/);
    await expect(table.locator('tbody tr[tabindex="0"]').first()).toContainText('VIP');
  });
});
