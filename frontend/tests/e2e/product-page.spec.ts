import { expect, test } from '@playwright/test';

// The product page: stock for the options chosen, sold-out options marked, section links, and on
// phones a buy bar in place of the marketplace tab bar.
test.describe('Product page', () => {
  test('shows stock for the chosen options and marks sold-out ones', async ({ page }) => {
    await page.goto('/en/p/iphone');
    await expect(page.getByRole('heading', { level: 1, name: 'iPhone 15' })).toBeVisible({
      timeout: 20_000,
    });
    const colours = page.getByRole('radiogroup', { name: 'Colour' });
    await expect(colours.getByRole('radio', { name: 'Black' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    // King Techno has only Black 128 GB in stock (demo data).
    await expect(colours.getByRole('radio', { name: 'Blue · Sold out' })).toBeVisible();
    await colours.getByRole('radio', { name: 'Blue · Sold out' }).click();
    await expect(page.getByText('Sold out').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add to cart' }).first()).toBeDisabled();
    await page
      .getByRole('navigation', { name: 'On this page' })
      .getByRole('link', { name: /Reviews/ })
      .click();
    await expect(page).toHaveURL(/#reviews$/);
  });

  test('on a phone the buy bar replaces the tab bar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en/p/iphone');
    await expect(page.getByRole('heading', { level: 1, name: 'iPhone 15' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: 'Buy now' })).toBeVisible();
    await expect(page.locator('.vb-tabbar')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
  });
});
