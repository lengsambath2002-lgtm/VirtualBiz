import { expect, test } from '@playwright/test';

import { DANA, signIn } from './_helpers/app';

const ADMIN = { email: 'admin@virtualbiz.com', password: 'Demo@1234' };
const ppDay = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Phnom_Penh' }).format(d);

// One date picker everywhere a date is chosen: presets, a two-month calendar where the first
// click is the start and the second the end, Apply / Cancel; the list follows the URL.
test.describe('Date picker', () => {
  test('a shop owner picks a custom range for order history', async ({ page }) => {
    await signIn(page, '/seller/orders?tab=all');
    const placed = page.getByRole('button', { name: /^Placed: / });
    await expect(placed).toHaveAccessibleName('Placed: Any time', { timeout: 20_000 });
    await placed.click();
    const cal = page.getByRole('dialog', { name: 'Placed' });
    const today = ppDay(new Date());
    const start = `${today.slice(0, 8)}01`;
    await cal.locator(`[data-day="${start}"]`).first().click();
    await cal.locator(`[data-day="${today}"]`).first().click();
    await cal.getByRole('button', { name: 'Apply' }).click();
    await expect(cal).toBeHidden();
    await expect(page).toHaveURL(
      new RegExp(`from=${start}&to=${today}|to=${today}.*from=${start}`),
    );
    await expect(page.getByRole('button', { name: /^Remove filter Placed/ })).toBeVisible();

    // Cancel keeps what was there; a preset applies at once.
    await placed.click();
    await cal.locator(`[data-day="${start}"]`).first().click();
    await cal.getByRole('button', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(new RegExp(`to=${today}`));
    await placed.click();
    await cal.getByRole('button', { name: 'Last 7 days' }).click();
    await expect(placed).toHaveAccessibleName('Placed: Last 7 days');
    await placed.click();
    await cal.getByRole('button', { name: 'Any time' }).click();
    await expect(placed).toHaveAccessibleName('Placed: Any time');
    await expect(page).not.toHaveURL(/from=/);
  });

  test('the console filters orders by a preset and Escape closes the calendar', async ({
    page,
  }) => {
    await signIn(page, '/admin/orders', ADMIN);
    const placed = page.getByRole('button', { name: /^Placed: / });
    await placed.click({ timeout: 20_000 });
    const cal = page.getByRole('dialog', { name: 'Placed' });
    await expect(cal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(cal).toBeHidden();
    await placed.click();
    await cal.getByRole('button', { name: 'Last 30 days' }).click();
    await expect(page).toHaveURL(/from=\d{4}-\d\d-\d\d/);
  });

  test('a provider jumps the calendar to another day', async ({ page }) => {
    await signIn(page, '/provider/calendar', DANA);
    const go = page.getByRole('button', { name: /^Go to date: / });
    await go.click({ timeout: 20_000 });
    const cal = page.getByRole('dialog', { name: 'Go to date' });
    await cal.getByRole('button', { name: 'Next month' }).click();
    const day = await cal.locator('[data-day$="-15"]').first().getAttribute('data-day');
    await cal.locator(`[data-day="${day}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`date=${day}`));
  });
});
