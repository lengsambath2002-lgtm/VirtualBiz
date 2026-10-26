import { expect, test } from '@playwright/test';

import { type Account, createAccount, signIn, trackErrors } from './_helpers/app';

const ADMIN: Account = { email: 'admin@virtualbiz.com', password: 'Demo@1234' };

test.describe('Legal pages, notifications, appearance and the homepage', () => {
  test('Terms and Privacy have real pages, linked from the footer and sign-up', async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await page.goto('/en/terms');
    await expect(page.getByRole('heading', { name: 'Terms of service', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your account' })).toBeVisible();
    await expect(page.getByText(/^Last updated /)).toBeVisible();
    await page.getByRole('link', { name: 'Privacy policy' }).first().click();
    await expect(page.getByRole('heading', { name: 'Privacy policy', level: 1 })).toBeVisible();
    await page.goto('/kh/privacy');
    await expect(page.getByRole('heading', { name: 'គោលការណ៍ឯកជនភាព', level: 1 })).toBeVisible();

    // Opened beside a half-typed sign-up, not instead of it.
    await page.goto('/en/sign-up');
    const terms = page.getByRole('link', { name: 'Terms' }).first();
    await expect(terms).toHaveAttribute('href', '/en/terms');
    await expect(terms).toHaveAttribute('target', '_blank');
    expect(errors).toEqual([]);
  });

  test('notification choices per topic and channel are kept @phone', async ({ page, request }) => {
    const errors = trackErrors(page);
    await signIn(page, '/account/settings', await createAccount(request, 'Notify Me'));
    // No shop yet: only their own orders and bookings.
    await expect(page.getByRole('checkbox', { name: 'Email for Low stock' })).toHaveCount(0);
    const orders = page.getByRole('checkbox', { name: 'Email for Orders' });
    await expect(orders).toBeChecked();
    await orders.uncheck();
    await expect(page.getByText('Settings saved')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('checkbox', { name: 'Email for Orders' })).not.toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Push for Orders' })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Email for Bookings' })).toBeChecked();
    expect(errors).toEqual([]);
  });

  test('shop owners also choose for their shops', async ({ page }) => {
    await signIn(page, '/account/settings');
    await expect(page.getByRole('checkbox', { name: 'Email for Low stock' })).toBeVisible();
    await expect(
      page.getByRole('checkbox', { name: 'Push for New orders and bookings' }),
    ).toBeVisible();
  });

  test('appearance: dark stays dark after a reload, Device follows the system', async ({
    page,
  }) => {
    await signIn(page, '/account/settings');
    const theme = page.getByRole('radiogroup', { name: 'Appearance' });
    await theme.getByRole('radio', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page
      .getByRole('radiogroup', { name: 'Appearance' })
      .getByRole('radio', { name: 'Device' })
      .click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);
  });

  test('a super-admin edits the homepage banners with a preview', async ({ page }) => {
    const errors = trackErrors(page);
    await signIn(page, '/admin/settings?tab=homepage', ADMIN);
    const main = page.getByRole('region', { name: 'Main banner' });
    const title = main.getByRole('group', { name: 'Title' }).getByLabel('English');
    const was = await title.inputValue();
    const next = `Rainy season deals ${Date.now().toString(36)}`;
    await title.fill(next);
    await expect(
      page.getByRole('region', { name: 'Preview' }).getByRole('heading', { name: next }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Homepage updated')).toBeVisible();

    await page.goto('/en/home');
    await expect(page.getByRole('heading', { name: next, level: 1 })).toBeVisible();

    // Put it back.
    await page.goto('/en/admin/settings?tab=homepage');
    await page
      .getByRole('region', { name: 'Main banner' })
      .getByRole('group', { name: 'Title' })
      .getByLabel('English')
      .fill(was);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Homepage updated')).toBeVisible();
    expect(errors).toEqual([]);
  });
});
