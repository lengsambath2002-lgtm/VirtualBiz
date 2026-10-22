import { expect as baseExpect, test } from '@playwright/test';

import { DANA, signIn, trackErrors } from './_helpers/app';

const expect = baseExpect.configure({ timeout: 20_000 });
const PASS = 'Team#Member2026';

test.describe('Shop team', () => {
  test('the owner invites staff, who work with their own login but cannot change settings', async ({
    page,
    browser,
  }) => {
    const errors = trackErrors(page);
    const email = `teammate.${Date.now().toString(36)}@example.com`;
    await signIn(page, '/seller/team');
    const panel = page.getByRole('region', { name: 'People and access' });
    await expect(panel.locator('strong', { hasText: 'Kry Sonita' })).toBeVisible();
    await panel.getByRole('button', { name: 'Invite someone' }).click();
    const dialog = page.getByRole('dialog', { name: 'Invite someone' });
    // Email only, several at once: typed, a comma, then a pasted list with a repeat and a typo.
    const second = `second.${Date.now().toString(36)}@example.com`;
    const emails = dialog.getByLabel('Emails');
    await emails.fill(`${email},`);
    await emails.fill(`${second} ${email} not-an-email`);
    await emails.press('Enter');
    await expect(dialog.getByText('Fix or remove the addresses in red.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Remove not-an-email' }).click();
    await expect(dialog.getByRole('button', { name: /^Remove / })).toHaveCount(2);
    await expect(dialog.getByRole('radio', { name: /^Manager/ })).toBeVisible();
    await dialog.getByRole('radio', { name: /^Staff/ }).check();
    await dialog.getByRole('button', { name: 'Send 2 invites' }).click();
    await expect(page.getByRole('heading', { name: '2 invites sent' })).toBeVisible();
    const link = (await page.getByTestId('team-invite-link').first().textContent())!.trim();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(panel.getByText('Pending invites')).toBeVisible();

    // The invitee joins and lands in the shop's workspace.
    const ctx = await browser.newContext();
    const vanna = await ctx.newPage();
    await vanna.goto(link);
    await expect(vanna.getByRole('heading', { name: 'Join Nita Gadget Store' })).toBeVisible();
    await vanna.getByLabel('Choose a password').fill(PASS);
    // Invited by email alone: they give their own name.
    await vanna.getByRole('button', { name: 'Join Nita Gadget Store' }).click();
    await expect(vanna.getByText('Enter your name, as your team will see it.')).toBeVisible();
    await vanna.getByLabel('Your name').fill('Vanna Cashier');
    await vanna.getByRole('button', { name: 'Join Nita Gadget Store' }).click();
    await expect(vanna).toHaveURL(/\/en\/seller$/);

    // Staff: settings are read-only, the payout account is the owner's, no invites.
    await vanna.goto('/en/seller/settings');
    await expect(
      vanna.getByText('Only the owner or a manager can change settings.', { exact: false }),
    ).toBeVisible();
    await expect(vanna.getByLabel('Shop name')).toBeDisabled();
    await vanna.goto('/en/seller/team');
    await expect(
      vanna.getByRole('region', { name: 'People and access' }).getByText('Vanna Cashier'),
    ).toBeVisible();
    await expect(vanna.getByRole('button', { name: 'Invite someone' })).toHaveCount(0);

    // The owner removes their access.
    await page.reload();
    const row = panel.getByRole('listitem').filter({ hasText: email });
    await expect(row).toContainText('Staff');
    await row.getByRole('button', { name: 'Remove access' }).click();
    await expect(page.getByText('Vanna Cashier can no longer sign in to this shop')).toBeVisible();
    // Former members are kept for their history, behind "Show removed".
    await expect(row).toBeHidden();
    await panel.getByRole('button', { name: /Show removed/ }).click();
    await expect(row).toContainText('removed');
    await ctx.close();
    expect(errors).toEqual([]);
  });

  test('a provider gives a calendar team member their own login', async ({ page }) => {
    const errors = trackErrors(page);
    await signIn(page, '/provider/team', DANA);
    const panel = page.getByRole('region', { name: 'People and access' });
    const row = panel.getByRole('listitem').filter({ hasText: 'No login yet' }).first();
    await expect(row).toBeVisible();
    const name = (await row.locator('strong').textContent())!.trim();
    await row.getByRole('button', { name: 'Give a login' }).click();
    const dialog = page.getByRole('dialog', { name: `Give ${name} a login` });
    await dialog.getByLabel('Email').fill(`stylist.${Date.now().toString(36)}@example.com`);
    await dialog.getByRole('button', { name: 'Send invite' }).click();
    await expect(page.getByRole('heading', { name: 'Invite sent' })).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(panel.getByText('Pending invites')).toBeVisible();
    // Withdraw it again (keeps the demo data as it was).
    const pending = panel.getByRole('listitem').filter({ hasText: name }).last();
    await pending.getByRole('button', { name: 'Withdraw' }).click();
    await expect(page.getByText('Invite withdrawn')).toBeVisible();
    expect(errors).toEqual([]);
  });
});
