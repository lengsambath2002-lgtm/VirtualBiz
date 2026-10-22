import { expect, test } from '@playwright/test';

import { DANA, signIn } from './_helpers/app';

const ADMIN = { email: 'admin@virtualbiz.com', password: 'Demo@1234' };

// docs/ui/navigation.md: one sidebar for both workspaces and the console.
test.describe('Workspace navigation', () => {
  test('the seller sidebar groups pages, marks the current one and collapses for good', async ({
    page,
  }) => {
    await signIn(page, '/seller/orders');
    const nav = page.getByRole('navigation', { name: 'Seller workspace' });
    await expect(nav.getByRole('link', { name: /^Orders/ })).toHaveAttribute(
      'aria-current',
      'page',
      { timeout: 20_000 },
    );
    await expect(nav.getByRole('group', { name: 'Manage' })).toContainText('Activity log');
    await nav.getByRole('link', { name: 'Activity log' }).click();
    await expect(page).toHaveURL(/\/seller\/activity$/);

    await nav.getByRole('button', { name: 'Collapse sidebar' }).click();
    await page.reload();
    await expect(
      page.getByRole('navigation', { name: 'Seller workspace' }).getByRole('button', {
        name: 'Expand sidebar',
      }),
    ).toBeVisible({ timeout: 20_000 });
    await page
      .getByRole('navigation', { name: 'Seller workspace' })
      .getByRole('button', { name: 'Expand sidebar' })
      .click();
  });

  test('the provider sidebar opens the booking page in a new tab', async ({ page }) => {
    await signIn(page, '/provider/clients', DANA);
    const nav = page.getByRole('navigation', { name: 'Provider workspace' });
    const view = nav.getByRole('link', { name: 'View booking page' });
    await expect(view).toHaveAttribute('target', '_blank', { timeout: 20_000 });
    await expect(view).toHaveAttribute('href', /\/en\/shop\//);
  });

  test('the console groups its pages and shows queue counts', async ({ page }) => {
    await signIn(page, '/admin', ADMIN);
    const nav = page.getByRole('navigation', { name: 'Admin console' });
    await expect(nav.getByRole('group', { name: 'Money' })).toContainText('Payouts', {
      timeout: 20_000,
    });
    await nav.getByRole('link', { name: /^Audit log/ }).click();
    await expect(page).toHaveURL(/\/admin\/audit/);
  });

  test('on a phone the bottom bar has the main pages and More opens the rest', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await signIn(page, '/seller');
    const bar = page.getByRole('navigation', { name: 'Seller workspace: main pages' });
    await expect(bar.getByRole('link', { name: 'Orders' })).toBeVisible({ timeout: 20_000 });
    await bar.getByRole('button', { name: 'More' }).click();
    const drawer = page.getByRole('dialog', { name: 'Seller workspace' });
    await drawer.getByRole('link', { name: /^Reviews/ }).click();
    await expect(page).toHaveURL(/\/seller\/reviews$/);
    await expect(drawer).toBeHidden();
    await bar.getByRole('button', { name: 'More' }).click();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
  });
});
