import { expect, test } from '@playwright/test';

import { createAccount, fillLogin, signIn } from './_helpers/app';

/**
 * The invite email's buttons (docs/ops/email.md): Accept and Decline open the invite page, which
 * asks for one click. Someone who already has a VirtualBiz account signs in (if needed) and joins
 * with no password; the shop is then one of their workspaces with the role they were given.
 */
test.describe('Team invite email', () => {
  async function invite(page: import('@playwright/test').Page, email: string) {
    await signIn(page, '/seller/team');
    await page.getByRole('button', { name: 'Invite someone' }).click();
    const dialog = page.getByRole('dialog', { name: 'Invite someone' });
    await dialog.getByLabel('Emails').fill(email);
    await dialog.getByLabel('Emails').press('Enter');
    await dialog.getByRole('radio', { name: /^Staff/ }).check();
    await dialog.getByRole('button', { name: 'Send invite' }).click();
    const link = (await page.getByTestId('team-invite-link').first().textContent())!.trim();
    await page.getByRole('button', { name: 'Done' }).click();
    return link;
  }

  test('an existing account signs in from the email and joins with one click', async ({
    page,
    browser,
    request,
  }) => {
    const them = await createAccount(request, 'Mony Existing');
    const link = await invite(page, them.email);

    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto(link);
    await expect(p.getByRole('heading', { name: 'Join Nita Gadget Store' })).toBeVisible();
    await expect(p.getByText('Day-to-day work')).toBeVisible();
    await p.getByRole('link', { name: 'Sign in to accept' }).click();
    await expect(p).toHaveURL(/sign-in\?.*next=%2Fjoin%2F/);
    await fillLogin(p, them.email, them.password);
    await expect(p.getByRole('button', { name: 'Accept invite' })).toBeVisible({ timeout: 20_000 });
    await expect(p.getByText(/You're signed in as Mony Existing/)).toBeVisible();
    await p.getByRole('button', { name: 'Accept invite' }).click();
    await expect(p).toHaveURL(/\/en\/seller$/, { timeout: 20_000 });
    await ctx.close();
  });

  test('Decline from the email asks once, then closes the invite', async ({ page, browser }) => {
    const email = `decline.${Date.now().toString(36)}@example.com`;
    const link = await invite(page, email);

    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto(`${link}?decline=1`);
    await expect(p.getByText(/Decline this invite\?/)).toBeVisible();
    await p.getByRole('button', { name: 'Decline', exact: true }).click();
    await expect(p.getByRole('heading', { name: 'Invite declined' })).toBeVisible();
    await p.goto(link);
    await expect(p.getByText("This invite can't be used")).toBeVisible();
    await ctx.close();

    // The shop's pending list no longer has it.
    await page.reload();
    await expect(page.getByText(email)).toHaveCount(0);
  });
});
