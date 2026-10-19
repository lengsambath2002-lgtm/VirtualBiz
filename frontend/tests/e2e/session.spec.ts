import { expect as baseExpect, type Page, test } from '@playwright/test';

import { createAccount, DANA, DEMO, fillLogin, signIn, trackErrors } from './_helpers/app';

// Signing in / out navigates to routes a cold dev server may still be compiling.
const expect = baseExpect.configure({ timeout: 20_000 });

/** The persisted session's user (null when signed out). */
const storedUser = (page: Page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem('vb-session');
    return raw ? (JSON.parse(raw).state?.user?.email ?? null) : null;
  });

/** After logging out, a workspace must send us back to sign-in. */
async function expectSignedOut(page: Page) {
  expect(await storedUser(page)).toBeNull();
  await page.goto('/en/seller');
  await expect(page).toHaveURL(/\/en\/sign-in\?next=%2Fseller/);
}

/** Confirm the "Log out?" dialog every surface shows. */
async function confirmLogout(page: Page, okName: string | RegExp = /^log out$/i) {
  const dialog = page
    .getByRole('dialog')
    .or(page.getByRole('alertdialog'))
    .filter({ hasText: /log out/i });
  await expect(dialog.first()).toBeVisible();
  await dialog.first().getByRole('button', { name: okName }).click();
}

test.describe('Session: log in and log out', () => {
  test('logging in opens the app straight away', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/en/sign-in');
    await fillLogin(page);

    await expect(page).toHaveURL(/\/en\/home$/);
    expect(await storedUser(page)).toBe(DEMO.email);

    // Session survives a reload: the refresh cookie gives a new access token.
    await page.reload();
    await expect(page.getByRole('button', { name: /^account$/i }).first()).toBeVisible();
    expect(await storedUser(page)).toBe(DEMO.email);
    expect(errors).toEqual([]);
  });

  test('opening sign-in while logged in goes home, or to ?next=', async ({ page }) => {
    await signIn(page, '/home');
    await page.goto('/en/sign-in');
    await expect(page).toHaveURL(/\/en\/home$/);
    await page.goto('/en/sign-in?next=%2Fseller%2Forders');
    await expect(page).toHaveURL(/\/en\/seller\/orders$/);
  });

  test('customer: log out from the account menu', async ({ page }) => {
    await signIn(page, '/home');
    await page
      .getByRole('button', { name: /^account$/i })
      .first()
      .click();
    await page
      .getByRole('menu')
      .getByRole('menuitem', { name: /log out/i })
      .click();
    await confirmLogout(page);
    expect(await storedUser(page)).toBeNull();
    // Signed-out header offers "Log in" again; the cart still works signed out.
    await expect(
      page
        .getByRole('button', { name: /log in/i })
        .or(page.getByRole('link', { name: /log in/i }))
        .first(),
    ).toBeVisible();
    await expectSignedOut(page);
  });

  test('seller: log out from the rail', async ({ page }) => {
    await signIn(page, '/seller');
    await page
      .getByRole('button', { name: /^log out$/i })
      .filter({ visible: true })
      .first()
      .click();
    await confirmLogout(page);
    await expect(page).toHaveURL(/\/en\/sign-in/);
    await expectSignedOut(page);
  });

  test('provider: log out from the rail', async ({ page }) => {
    await signIn(page, '/provider', DANA);
    await page
      .getByRole('button', { name: /^log out$/i })
      .filter({ visible: true })
      .first()
      .click();
    await confirmLogout(page);
    await expect(page).toHaveURL(/\/en\/sign-in/);
    await expectSignedOut(page);
  });
});

test.describe('Account centre', () => {
  const openMenu = async (page: Page) => {
    await page
      .getByRole('button', { name: /^account$/i })
      .first()
      .click();
    return page.getByRole('menu');
  };

  test('menu: my profile, my settings, switch to shop, help centre, log out', async ({ page }) => {
    const errors = trackErrors(page);
    await signIn(page, '/home');
    let menu = await openMenu(page);
    await expect(menu.getByRole('menuitem')).toHaveText([
      'My profile',
      'My settings',
      'Switch to shop',
      'Help centre',
      'Log out',
    ]);
    await menu.getByRole('menuitem', { name: 'My profile' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'My profile' })).toBeVisible();

    menu = await openMenu(page);
    await menu.getByRole('menuitem', { name: 'My settings' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'My settings' })).toBeVisible();

    menu = await openMenu(page);
    await menu.getByRole('menuitem', { name: 'Switch to shop' }).click();
    // Facebook-style: personal account (current), then each business with its type and role.
    await expect(menu.getByRole('menuitemradio', { name: /Kry Sonita/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(menu.getByRole('menuitemradio', { name: /Nita Gadget Store/ })).toContainText(
      'Product shop',
    );
    await expect(menu.getByRole('menuitemradio', { name: /Nita Gadget Store/ })).toContainText(
      'Owner',
    );
    // Only the user's own memberships (Glow Beauty Salon belongs to Try Dana).
    await expect(menu.getByRole('menuitemradio', { name: /Glow Beauty Salon/ })).toHaveCount(0);
    await menu.getByRole('menuitemradio', { name: /Nita Gadget Store/ }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Switching to Nita Gadget Store' }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/en\/seller/);

    // In the workspace the avatar switches back to the personal account.
    await page
      .getByRole('button', { name: /account/i })
      .last()
      .click();
    const sw = page.getByRole('menu', { name: 'Switch profile' });
    await expect(sw.getByRole('menuitemradio', { name: /Nita Gadget Store/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await sw.getByRole('menuitemradio', { name: /Kry Sonita/ }).click();
    await expect(page).toHaveURL(/\/en\/home$/);
    expect(errors).toEqual([]);
  });

  test('switch to the service provider workspace', async ({ page }) => {
    await signIn(page, '/home', DANA);
    const menu = await openMenu(page);
    await menu.getByRole('menuitem', { name: 'Switch to shop' }).click();
    await menu.getByRole('menuitemradio', { name: /Glow Beauty Salon/ }).click();
    await expect(page).toHaveURL(/\/en\/provider/);
  });

  test('change password from My settings', async ({ page, request }) => {
    // A fresh account, so the demo user's password stays Demo@1234.
    const acct = await createAccount(request);
    await signIn(page, '/account/settings', acct);
    await page.getByRole('button', { name: 'Change password' }).click();
    await page.getByLabel('Current password').fill('Wrong#1');
    await page.getByLabel('New password').fill('Bright#2026');
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByText('Current password is incorrect.')).toBeVisible();
    await page.getByLabel('Current password').fill(acct.password);
    await page.getByLabel('New password').fill('Bright#2027');
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByText('Password updated.')).toBeVisible();
  });
});

test.describe('Addresses (API)', () => {
  test('add, make default, delete and undo', async ({ page, request }) => {
    const acct = await createAccount(request);
    await signIn(page, '/account/addresses', acct);
    await page
      .getByRole('button', { name: /add address/i })
      .first()
      .click();
    const sheet = page.getByRole('dialog');
    await sheet.getByLabel('House / street').fill('#12, St. 516');
    await sheet.getByLabel('Phone').fill('012 345 678');
    await sheet.getByRole('button', { name: 'Save address' }).click();
    await expect(page.getByText('Address saved')).toBeVisible();
    // The first address is always the default.
    await expect(page.getByText('#12, St. 516')).toBeVisible();

    await page
      .getByRole('button', { name: /add address/i })
      .first()
      .click();
    await sheet.getByText('Work').click();
    await sheet.getByLabel('House / street').fill('Vattanac Tower, Floor 9');
    await sheet.getByLabel('Phone').fill('012 345 678');
    await sheet.getByRole('button', { name: 'Save address' }).click();
    await expect(page.getByText('Vattanac Tower, Floor 9')).toBeVisible();

    await page.getByRole('button', { name: 'Set default' }).click();
    await expect(page.getByText('Default address updated')).toBeVisible();

    await page.getByRole('button', { name: /delete work/i }).click();
    await expect(page.getByText('Vattanac Tower, Floor 9')).toHaveCount(0);
    await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText('Vattanac Tower, Floor 9')).toBeVisible();

    // Saved on the server: still there after a reload.
    await page.reload();
    await expect(page.getByText('Vattanac Tower, Floor 9')).toBeVisible();
  });
});
