import { expect as baseExpect, test } from '@playwright/test';

import { signIn, trackErrors } from './_helpers/app';

const expect = baseExpect.configure({ timeout: 20_000 });

test.describe('Manual orders', () => {
  test('a phone order joins the list accepted, with its source', async ({ page }) => {
    const errors = trackErrors(page);
    const name = `Chan Sophea ${Date.now().toString(36)}`;
    await signIn(page, '/seller/orders');
    // The orders page's own button (the top bar's New menu opens the same dialog).
    await page.getByRole('main').getByRole('button', { name: 'Manual order' }).click();
    const dialog = page.getByRole('dialog', { name: 'New manual order' });
    await expect(dialog).toBeVisible();

    // Nothing entered: it says what is missing.
    await dialog.getByRole('button', { name: /Create order/ }).click();
    await expect(dialog.getByText('Add at least one item.')).toBeVisible();

    await dialog.getByRole('button', { name: 'Phone', exact: true }).click();
    await dialog.getByPlaceholder('Search a product, SKU or scan a barcode').fill('USB-C to USB-C');
    await dialog.getByRole('option').first().click();
    await dialog.getByLabel('One more').click();
    await dialog.getByLabel('Customer name').fill(name);
    await dialog.getByLabel('Phone', { exact: true }).fill('012 345 678');
    await dialog.getByLabel('Address', { exact: true }).fill('#12, St. 271');
    await dialog.getByLabel('District').selectOption({ label: 'Toul Kork' });
    await expect(dialog.getByLabel('Delivery fee (USD)')).toHaveValue('1.5');
    await dialog.getByRole('button', { name: 'Create order · $13.50' }).click();

    await expect(page.getByText(/Order VB-\d+ created/)).toBeVisible();
    // The new order opens: accepted, from the phone, for this customer.
    const drawer = page.getByRole('dialog').filter({ hasText: name });
    await expect(drawer.getByText('Phone', { exact: true })).toBeVisible();
    await expect(drawer.getByText('$13.50').first()).toBeVisible();
    expect(errors).toEqual([]);
  });
});
