import { expect as baseExpect, type Locator, type Page, test } from '@playwright/test';
import path from 'node:path';

import { createAccount, signIn, trackErrors } from './_helpers/app';

const expect = baseExpect.configure({ timeout: 20_000 });
const IMAGE = path.join(__dirname, '_helpers/id-card.png');

/** Click a button that opens the file chooser and give it the test image. */
async function choose(page: Page, button: Locator) {
  const chooser = page.waitForEvent('filechooser');
  await button.click();
  await (await chooser).setFiles(IMAGE);
}

const hasPhoto = (el: Locator) =>
  expect(el).toHaveCSS('background-image', /\/api\/files\/[0-9a-f-]{36}/);

test.describe('Profile and shop photos', () => {
  test('a customer adds a profile photo and cover, and removes the photo', async ({
    page,
    request,
  }) => {
    const errors = trackErrors(page);
    const account = await createAccount(request, 'Sok Photo');
    await signIn(page, '/account/profile', account);

    await choose(page, page.getByRole('button', { name: 'Add photo' }));
    await expect(page.getByText('Photo saved')).toBeVisible();
    await hasPhoto(page.getByTestId('profile-avatar'));
    await choose(page, page.getByRole('button', { name: 'Add cover photo' }));
    await hasPhoto(page.getByTestId('profile-cover'));

    // Kept on the account: still there after a reload.
    await page.reload();
    await hasPhoto(page.getByTestId('profile-avatar'));
    await hasPhoto(page.getByTestId('profile-cover'));

    await page.getByRole('button', { name: 'Remove photo' }).click();
    await expect(page.getByText('Photo removed')).toBeVisible();
    await expect(page.getByTestId('profile-avatar')).toHaveText('SP');
    expect(errors).toEqual([]);
  });

  test('a shop opens without payout details, then gets a logo and cover', async ({
    page,
    request,
  }) => {
    const errors = trackErrors(page);
    const account = await createAccount(request, 'Sok Shop');
    const name = `Sok Phones ${Date.now().toString(36)}`;
    await signIn(page, '/home', account);
    await page.goto('/en/create-business?new=1');
    await page.getByText('I sell products').click();
    await page.getByLabel('Shop name').fill(name);
    await page.getByRole('button', { name: 'Phones & electronics' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Street or landmark').fill('#12, St. 516');
    await page.getByLabel('Phone for customers').fill('012345678');
    await page.getByRole('button', { name: 'Continue' }).click();

    // A badly typed Bakong ID still blocks; skipping opens the shop without one.
    await page.getByLabel('Your Bakong ID').fill('not an id');
    await page.getByRole('button', { name: 'Open my shop' }).click();
    await expect(page.getByLabel('Your Bakong ID')).toBeVisible();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await expect(page.getByRole('heading', { name: `${name} is open!` })).toBeVisible();
    await expect(page.getByText(/Payouts are off until you add your Bakong ID/)).toBeVisible();

    await page.getByRole('button', { name: 'Go to my shop' }).click();
    await expect(page).toHaveURL(/\/en\/seller/);
    await page.goto('/en/seller/settings');
    await choose(page, page.getByRole('button', { name: 'Add logo' }));
    await expect(page.getByText('Photo saved')).toBeVisible();
    await hasPhoto(page.getByTestId('shop-logo'));
    await choose(page, page.getByRole('button', { name: 'Add cover photo' }));
    await hasPhoto(page.getByTestId('shop-cover'));

    // Saved on the business: the settings page shows them after a reload.
    await page.reload();
    await hasPhoto(page.getByTestId('shop-logo'));
    await hasPhoto(page.getByTestId('shop-cover'));
    expect(errors).toEqual([]);
  });
});
