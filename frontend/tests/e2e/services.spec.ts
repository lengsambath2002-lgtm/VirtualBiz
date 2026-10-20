import { expect as baseExpect, test } from '@playwright/test';

import { DANA, signIn, trackErrors } from './_helpers/app';

const expect = baseExpect.configure({ timeout: 20_000 });

test.describe('Provider services', () => {
  test('search and category chips filter the tables; each category adds into itself', async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await signIn(page, '/provider/services', DANA);
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: /^Hair/ })).toBeVisible();

    // A chip keeps one category.
    await main.getByRole('button', { name: /^Nails/ }).click();
    await expect(main.getByRole('heading', { name: /^Hair/ })).toBeHidden();
    await expect(main.getByRole('row', { name: /Gel Manicure/ })).toBeVisible();
    await main.getByRole('button', { name: /^All/ }).click();

    // Search narrows; nothing found says so and clears.
    await main.getByPlaceholder('Search services').fill('pedicure');
    await expect(main.getByRole('row', { name: /Spa Pedicure/ })).toBeVisible();
    await expect(main.getByRole('row', { name: /Haircut/ })).toBeHidden();
    await main.getByPlaceholder('Search services').fill('zzz');
    await expect(main.getByText('No services match “zzz”')).toBeVisible();
    await main.getByRole('button', { name: 'Clear filters' }).click();
    await expect(main.getByRole('row', { name: /Haircut/ })).toBeVisible();

    // "Add to Nails" opens the form with Nails chosen.
    await main.getByRole('button', { name: 'Add to Nails' }).click();
    await expect(page.getByRole('dialog').getByLabel('Category')).toHaveValue('Nails');
    expect(errors).toEqual([]);
  });
});
