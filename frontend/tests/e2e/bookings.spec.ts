import { expect, test } from '@playwright/test';

import { createAccount, DANA, signIn } from './_helpers/app';

// Phase 4 (docs/api/phase4-bookings-provider.md): a customer books a time the API offers, the
// salon accepts it in the workspace, the customer sees it confirmed and can cancel it.
test.describe('bookings', () => {
  test('book online, the salon accepts, the customer cancels', async ({
    page,
    browser,
    request,
  }) => {
    const who = `Rotha ${Date.now().toString(36).slice(-5)}`;
    const account = await createAccount(request, who);
    await signIn(page, '/s/glow-pedi', account);
    await expect(page.getByRole('heading', { name: 'Spa Pedicure' })).toBeVisible({
      timeout: 20_000,
    });

    // The first day after today with a free time (Srey Leak is off some days).
    const days = page.getByRole('radiogroup', { name: 'Date' }).getByRole('radio');
    const free = page.locator('button:not([disabled])').filter({ hasText: /^\d\d:\d\d$/ });
    for (let i = 1; i < 7; i++) {
      await days.nth(i).click();
      await page.waitForTimeout(800);
      if (await free.count()) break;
    }
    const time = (await free.last().innerText()).trim();
    await free.last().click();
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page).toHaveURL(/\/s\/glow-pedi\/book$/);
    // A phone of its own: the salon matches online bookers to its clients by phone.
    const phone = `09${String(Date.now()).slice(-8)}`;
    await page.getByLabel('Phone').fill(phone);
    await page.locator('form').getByRole('button').last().click();
    await expect(page).toHaveURL(/\/en\/bookings\/BK-\d{5,}$/, { timeout: 20_000 });
    const number = page.url().split('/').pop()!;
    await expect(page.getByText('Requested').first()).toBeVisible();
    await expect(page.getByText(time).first()).toBeVisible();

    // The salon sees the request and accepts it.
    const salon = await (await browser.newContext({ timezoneId: 'Asia/Phnom_Penh' })).newPage();
    await signIn(salon, '/provider/calendar', DANA);
    await salon.getByRole('link', { name: 'Home' }).first().click();
    const row = salon
      .locator('div')
      .filter({ hasText: who })
      .filter({ has: salon.getByRole('button', { name: 'Accept' }) })
      .last();
    await row.getByRole('button', { name: 'Accept' }).click();
    // A clash with another booking asks first.
    const confirm = salon.getByRole('dialog').getByRole('button', { name: /Accept anyway|Accept/ });
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
    await expect(salon.getByText(/Accepted/)).toBeVisible();
    await salon.close();

    // The customer's page follows (live stream or reload) and the booking can be cancelled.
    await page.reload();
    await expect(page.getByText('Confirmed').first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('dialog').getByRole('button').last().click();
    await expect(page.getByText('Cancelled').first()).toBeVisible();
    const api = await page.request.get(`/api/marketplace/items/glow-pedi/availability?days=7`);
    expect(api.ok()).toBe(true);
    expect(number).toMatch(/^BK-/);
  });
});
