import { expect, test } from '@playwright/test';

import { trackErrors } from './_helpers/app';

test.describe('Landing', () => {
  test('pricing calculator charges 5% of online sales only', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/en');
    const pricing = page.locator('#pricing');
    const sliders = pricing.locator('input[type=range]');
    await sliders.nth(0).fill('7300');
    await sliders.nth(1).fill('12500');
    await expect(pricing).toContainText('$365');
    await expect(pricing).toContainText('$19,435');
    await expect(pricing).toContainText('1.8%');
    expect(errors).toEqual([]);
  });

  test('hero search opens results with query and district', async ({ page }) => {
    await page.goto('/en');
    await page.getByPlaceholder(/iced latte/i).fill('iced latte');
    await page
      .getByRole('button', { name: /^search$/i })
      .first()
      .click();
    // The landing shows a toast first; a cold dev server also compiles /search on first visit.
    await expect(page).toHaveURL(/\/en\/search\?q=iced\+latte&district=toul-kork/, {
      timeout: 20_000,
    });
  });

  test('language switcher shows flags and keeps the page', async ({ page }) => {
    await page.goto('/en');
    await page.getByRole('button', { name: 'Language' }).click();
    await page.getByRole('option').filter({ hasText: 'ខ្មែរ' }).getByRole('button').click();
    await expect(page).toHaveURL(/\/kh$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'km');
  });
});
