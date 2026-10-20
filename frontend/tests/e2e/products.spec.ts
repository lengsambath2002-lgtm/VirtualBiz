import { expect as baseExpect, test } from '@playwright/test';
import path from 'node:path';

import { signIn, trackErrors } from './_helpers/app';

const expect = baseExpect.configure({ timeout: 20_000 });
const PHOTO = path.join(__dirname, '_helpers/id-card.png');

test.describe('Products', () => {
  test('"Add product" opens a popup; the product goes live and joins the table', async ({
    page,
  }) => {
    const errors = trackErrors(page);
    const name = `E2E Power Bank ${Date.now().toString(36)}`;
    await signIn(page, '/seller/products');
    await page.getByRole('main').getByRole('button', { name: 'Add product' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add product' });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/seller\/products$/);

    // Nothing entered: each field says what it needs, and the message goes once it's fixed.
    await dialog.getByRole('button', { name: 'Add product' }).click();
    await expect(dialog.getByText('Enter a price.')).toBeVisible();
    await dialog.getByLabel('Price (USD)').fill('19.90');
    await expect(dialog.getByText('Enter a price.')).toBeHidden();

    await dialog.getByLabel('Product name').fill(name);
    await dialog.getByLabel('Category').selectOption({ label: 'Accessories' });
    await dialog.getByLabel('Compare-at price').fill('24');
    await dialog.getByLabel('Cost per item').fill('11');
    await expect(dialog.getByText('45% margin')).toBeVisible();
    await dialog.getByLabel('Opening stock').fill('12');
    await dialog.locator('input[type=file]').setInputFiles(PHOTO);
    await expect(dialog.getByText('Cover')).toBeVisible();
    await dialog.getByRole('button', { name: 'Add product' }).click();

    await expect(page.getByText(`${name} is live on VirtualBiz`)).toBeVisible();
    await expect(dialog).toBeHidden();
    await page.getByPlaceholder('Search title, SKU or barcode').fill(name);
    const row = page.getByRole('row', { name: new RegExp(name) });
    await expect(row).toBeVisible();
    await expect(row.getByText('$19.90')).toBeVisible();
    await expect(row.getByText('$24.00')).toBeVisible();
    await expect(row.getByText('12', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('the table sorts by a column', async ({ page }) => {
    await signIn(page, '/seller/products');
    const price = page.getByRole('columnheader', { name: /Price/ });
    await price.getByRole('button').click();
    await expect(price).toHaveAttribute('aria-sort', 'descending');
    await price.getByRole('button').click();
    await expect(price).toHaveAttribute('aria-sort', 'ascending');
  });
});
