import { expect, test } from '@playwright/test';

import { createAccount, fillLogin, forgetSession, signIn, trackErrors } from './_helpers/app';
import { freshTotp } from './_helpers/totp';

// Two-step sign-in for every account (docs/api/two-step.md): turned on in Your account →
// Settings, then every sign-in asks for a code from the authenticator app.
test('a customer turns on two-step sign-in and the next sign-in asks for a code', async ({
  page,
  request,
}) => {
  const errors = trackErrors(page);
  const acct = await createAccount(request, 'Two Step');
  await signIn(page, '/account/settings', acct);

  const panel = page.getByRole('region', { name: 'Two-step sign-in' });
  await panel.getByRole('button', { name: 'Turn on' }).click();
  await expect(panel.getByRole('img', { name: /QR code/ })).toBeVisible();
  const secret = (await panel.getByTestId('two-step-secret').textContent())!.replace(/\s/g, '');
  await panel.getByLabel('6-digit code from the app').fill(await freshTotp(secret));
  await panel.getByRole('button', { name: 'Turn on' }).click();
  await expect(panel.getByTestId('recovery-codes').locator('code')).toHaveCount(10);
  const recovery = (await panel
    .getByTestId('recovery-codes')
    .locator('code')
    .first()
    .textContent())!;
  await expect(panel.getByRole('button', { name: 'Done' })).toBeDisabled();
  await panel.getByLabel('I’ve saved these codes').check();
  await panel.getByRole('button', { name: 'Done' }).click();
  await expect(panel).toContainText('10 recovery codes left');

  // The password alone no longer signs in: the app's code is asked for.
  await forgetSession(page);
  await page.goto('/en/sign-in?next=%2Faccount%2Fsettings');
  await fillLogin(page, acct.email, acct.password);
  await expect(page.getByRole('heading', { name: 'Two-step sign-in' })).toBeVisible();
  await page.getByLabel('6-digit code').fill('000000');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText(/That code isn’t right\. 4 tries left\./)).toBeVisible();
  await page.getByLabel('6-digit code').fill(await freshTotp(secret));
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/en\/account\/settings$/);

  // A lost phone: a recovery code works once, and turns it off.
  await forgetSession(page);
  await page.goto('/en/sign-in?next=%2Faccount%2Fsettings');
  await fillLogin(page, acct.email, acct.password);
  await page.getByRole('button', { name: 'Lost your phone? Use a recovery code' }).click();
  await page.getByLabel('Recovery code').fill(recovery);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/en\/account\/settings$/);
  const again = page.getByRole('region', { name: 'Two-step sign-in' });
  await expect(again).toContainText('9 recovery codes left');
  await again.getByRole('button', { name: 'Turn off' }).click();
  await again.getByLabel('6-digit code from the app').fill(await freshTotp(secret));
  await again.getByRole('button', { name: 'Turn off' }).click();
  await expect(again.getByRole('button', { name: 'Turn on' })).toBeVisible();
  expect(errors.filter((e) => !/422|403/.test(e))).toEqual([]);
});
