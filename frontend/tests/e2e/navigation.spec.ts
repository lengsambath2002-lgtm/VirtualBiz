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

  test('every workspace ends with Settings, Explore and Log out', async ({ page }) => {
    for (const [path, name, account] of [
      ['/seller', 'Seller workspace', undefined],
      ['/provider/clients', 'Provider workspace', DANA],
      ['/admin', 'Admin console', ADMIN],
    ] as const) {
      await signIn(page, path, account);
      const nav = page.getByRole('navigation', { name });
      await expect(nav.getByRole('link', { name: 'Settings' })).toBeVisible({ timeout: 20_000 });
      const explore = nav.getByRole('link', { name: 'Explore' });
      await expect(explore).toHaveAttribute('href', '/en/search');
      await expect(explore).toHaveAttribute('target', '_blank');
      await expect(nav.getByRole('button', { name: 'Log out' })).toBeVisible();
    }
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

  test('a count says what it counts and opens exactly those rows', async ({ page }) => {
    await signIn(page, '/admin', ADMIN);
    const nav = page.getByRole('navigation', { name: 'Admin console' });
    const stuck = nav.getByRole('link', { name: /orders? (is|are) stuck/ });
    await expect(stuck).toBeVisible({ timeout: 20_000 });
    const n = Number((await stuck.textContent())!.replace('+', ''));
    await stuck.click();
    await expect(page).toHaveURL(/\/admin\/orders\?status=stuck/);
    await expect(page.getByRole('note')).toContainText('Stuck orders');
    if (n < 99) {
      await expect(page.getByRole('navigation', { name: 'Pages' })).toContainText(`of ${n}`);
    }

    const waiting = nav.getByRole('link', { name: /waiting for an ID check/ });
    await waiting.click();
    await expect(page).toHaveURL(/verification=PENDING/);
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
