import { expect as baseExpect, test } from '@playwright/test';

import { fillLogin, signIn, trackErrors, type Account } from './_helpers/app';
import { freshTotp } from './_helpers/totp';

const expect = baseExpect.configure({ timeout: 20_000 });
const ADMIN: Account = { email: 'admin@virtualbiz.com', password: 'Demo@1234' };
const STRONG = 'Console#Pass2026';

test.describe('Staff security', () => {
  test('an invited person joins, turns on two-step sign-in, and later signs in with a recovery code', async ({
    page,
    browser,
  }) => {
    const errors = trackErrors(page);
    const email = `staff.${Date.now().toString(36)}@example.com`;

    // A super-admin invites them.
    await signIn(page, '/admin/settings?tab=staff', ADMIN);
    await page.getByRole('button', { name: 'Invite staff' }).click();
    const dialog = page.getByRole('dialog', { name: 'Invite staff' });
    await dialog.getByLabel('Name').fill('Chan Dara');
    await dialog.getByLabel('Work email').fill(email);
    await dialog.getByRole('button', { name: 'Send invite' }).click();
    await expect(page.getByRole('heading', { name: 'Invite sent' })).toBeVisible();
    const link = (await page.getByTestId('invite-link').textContent())!.trim();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByText('Pending invites')).toBeVisible();

    // They open the link in their own browser and join with a strong password.
    const ctx = await browser.newContext();
    const dara = await ctx.newPage();
    const daraErrors = trackErrors(dara);
    await dara.goto(link);
    await expect(dara.getByRole('heading', { name: 'Join VirtualBiz as Admin' })).toBeVisible();
    await dara.getByLabel('Choose a password').fill('short');
    await dara.getByLabel('Type it again').fill('short');
    await dara.getByRole('button', { name: 'Join the staff' }).click();
    await expect(dara.getByText("The password doesn't meet the rules.")).toBeVisible();
    await dara.getByLabel('Choose a password').fill(STRONG);
    await dara.getByLabel('Type it again').fill(STRONG);
    await dara.getByRole('button', { name: 'Join the staff' }).click();

    // The console asks for two-step sign-in before anything else.
    await expect(dara.getByRole('heading', { name: 'Turn on two-step sign-in' })).toBeVisible();
    await expect(
      dara.getByRole('img', { name: 'QR code for your authenticator app' }),
    ).toBeVisible();
    const secret = (await dara.getByTestId('mfa-secret').textContent())!.replace(/\s/g, '');
    await dara.getByLabel('6-digit code from the app').fill('000000');
    await dara.getByRole('button', { name: 'Turn on' }).click();
    await expect(dara.getByText(/That code isn't right/)).toBeVisible();
    await dara.getByLabel('6-digit code from the app').fill(await freshTotp(secret));
    await dara.getByRole('button', { name: 'Turn on' }).click();
    await expect(dara.getByRole('heading', { name: 'Save your recovery codes' })).toBeVisible();
    const codes = (await dara.getByTestId('recovery-codes').innerText())
      .split(/\s+/)
      .filter(Boolean);
    expect(codes).toHaveLength(10);
    const open = dara.getByRole('button', { name: 'Open the console' });
    await expect(open).toBeDisabled();
    await dara.getByLabel("I've saved my recovery codes").check();
    await open.click();
    await expect(dara.getByRole('heading', { name: 'Overview' })).toBeVisible();

    // The team shows them with two-step on; the invite is used up.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    const row = page.getByRole('row', { name: new RegExp(email) });
    await expect(row).toContainText('On');

    // Next sign-in (lost phone): a recovery code gets them in, once.
    await ctx.clearCookies();
    await dara.evaluate(() => localStorage.clear());
    await dara.goto('/en/sign-in?next=%2Fadmin');
    await fillLogin(dara, email, STRONG);
    await expect(dara.getByRole('heading', { name: 'Two-step sign-in' })).toBeVisible();
    await dara.getByRole('button', { name: 'Lost your phone? Use a recovery code' }).click();
    await dara.getByLabel('Recovery code').fill(codes[0]!);
    await dara.getByRole('button', { name: 'Continue' }).click();
    await expect(dara.getByRole('heading', { name: 'Overview' })).toBeVisible();

    // A super-admin resets their two-step sign-in: they must set it up again.
    await row.getByRole('button', { name: 'Reset two-step sign-in for Chan Dara' }).click();
    await page
      .getByLabel('How you confirmed it’s them')
      .or(page.getByLabel("How you confirmed it's them"))
      .fill('Called them on their known number');
    await page.getByRole('dialog').getByRole('button', { name: 'Reset' }).click();
    await expect(page.getByText('Chan Dara will set up two-step sign-in again')).toBeVisible();
    await expect(row).toContainText('Not set up');

    // Removed from staff (also keeps the dev database's staff list short).
    await row.getByRole('button', { name: 'Remove Chan Dara from staff' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByText('Chan Dara is no longer staff')).toBeVisible();
    await expect(row).toBeHidden();

    await page.goto('/en/admin/audit?targetType=USER');
    await expect(page.locator('section').getByText('Reset two-step sign-in').first()).toBeVisible();
    await expect(
      page.locator('section').getByText('Turned on two-step sign-in').first(),
    ).toBeVisible();
    expect(errors).toEqual([]);
    // The only failed request is the wrong code typed on purpose (422).
    expect(daraErrors.filter((e) => !/status of 422/.test(e))).toEqual([]);
    await ctx.close();
  });
});
