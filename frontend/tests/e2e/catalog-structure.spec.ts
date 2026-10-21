import { expect as baseExpect, test } from '@playwright/test';

import { DANA, signIn, trackErrors } from './_helpers/app';

const expect = baseExpect.configure({ timeout: 20_000 });

test.describe('Catalog structure', () => {
  test('a shop owner adds, renames and deletes a collection', async ({ page }) => {
    const errors = trackErrors(page);
    const name = `Gift sets ${Date.now().toString(36)}`;
    await signIn(page, '/seller/products');
    await page.getByRole('button', { name: 'Collections', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Collections' });
    await dialog.getByLabel('New collection name').fill(name);
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByText(`${name} added`)).toBeVisible();
    const field = dialog.getByLabel(`Name of ${name}`);
    await expect(field).toBeVisible();
    // The products page's filter offers it.
    await expect(page.getByLabel('Category').locator('option', { hasText: name })).toHaveCount(1);

    await field.fill(`${name} box`);
    await field.press('Enter');
    await expect(page.getByText(`Renamed to ${name} box`)).toBeVisible();
    await dialog.getByRole('button', { name: `Delete ${name} box` }).click();
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText(`${name} box deleted`)).toBeVisible();
    await expect(dialog.getByLabel(`Name of ${name} box`)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('a provider adds a service category the service form offers, then removes it', async ({
    page,
  }) => {
    const errors = trackErrors(page);
    const name = `Lashes ${Date.now().toString(36)}`;
    await signIn(page, '/provider/services', DANA);
    await page.getByRole('button', { name: 'Categories', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Service categories' });
    await dialog.getByLabel('New category').fill(name);
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByText(`${name} added`)).toBeVisible();
    await expect(dialog.getByLabel(`Name of ${name}`)).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Add service' }).first().click();
    await expect(page.getByLabel('Category').locator('option', { hasText: name })).toHaveCount(1);
    await expect(page.getByLabel('Description')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Categories', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Service categories' })
      .getByRole('button', { name: `Remove ${name}` })
      .click();
    await expect(page.getByText(`${name} removed`)).toBeVisible();
    expect(errors).toEqual([]);
  });
});
