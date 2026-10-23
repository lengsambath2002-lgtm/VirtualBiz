import { expect as baseExpect, test } from '@playwright/test';

import { signIn, trackErrors, type Account } from './_helpers/app';

const expect = baseExpect.configure({ timeout: 20_000 });
const ADMIN: Account = { email: 'admin@virtualbiz.com', password: 'Demo@1234' };

test.describe('Not found, errors and empty states', () => {
  test('an unknown address shows the 404 inside the marketplace', async ({ page }) => {
    await page.goto('/en/this-page-does-not-exist');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    // The marketplace layout streams, so the status is 200; Next marks the page noindex instead.
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(1);
    await expect(page.getByText('404')).toBeVisible();
    // The marketplace header stays, so the customer can search from here.
    await expect(page.getByPlaceholder('Search products, services and shops')).toBeVisible();
    await page.getByRole('link', { name: 'Go to home' }).click();
    await expect(page).toHaveURL(/\/en\/home$/);
  });

  test('a product that does not exist says so', async ({ page }) => {
    await page.goto('/en/p/no-such-product-123');
    await expect(page.getByRole('heading', { name: 'This product isn’t available' })).toBeVisible();
  });

  test('a failed search is an error with a retry, not "no results"', async ({ page }) => {
    let fail = true;
    // The API answering with an error of its own: "something went wrong".
    await page.route('**/api/marketplace/search**', (route) =>
      fail
        ? route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ status: { code: 'INTERNAL_ERROR', message: 'Error' } }),
          })
        : route.continue(),
    );
    await page.goto('/en/search?q=coffee');
    await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();
    fail = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeHidden();
  });

  test('a server that is down or starting up is said so, not "contact support"', async ({
    page,
  }) => {
    // A gateway error without the API's own reply (the server is asleep or restarting).
    await page.route('**/api/marketplace/search**', (route) =>
      route.fulfill({ status: 502, body: '' }),
    );
    await page.goto('/en/search?q=coffee');
    await expect(
      page.getByRole('heading', { name: "Can't reach VirtualBiz right now" }),
    ).toBeVisible();
    await expect(page.getByText('The server may be starting up')).toBeVisible();
  });

  test('the marketplace says when it cannot load at all', async ({ page }) => {
    await page.route('**/api/marketplace/**', (route) => route.abort('internetdisconnected'));
    await page.goto('/en/home');
    await expect(
      page.getByRole('heading', { name: /You are offline|Something went wrong/ }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  test('workspace and console 404s keep their frame', async ({ page }) => {
    const errors = trackErrors(page);
    await signIn(page, '/seller');
    await page.goto('/en/seller/nowhere');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect(page.getByRole('navigation').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to dashboard' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('the console says when a shop does not exist', async ({ page }) => {
    await signIn(page, '/admin', ADMIN);
    await page.goto('/en/admin/shops/00000000-0000-4000-8000-000000000000');
    await expect(page.getByRole('heading', { name: 'Shop not found' })).toBeVisible();
    await page.getByRole('link', { name: 'All shops' }).click();
    await expect(page.getByRole('heading', { name: 'Shops' })).toBeVisible();
    await page.goto('/en/admin/nowhere');
    await expect(page.getByRole('link', { name: 'Back to the console' })).toBeVisible();
  });

  test('a shop with nothing listed yet still has its page; an unknown one is not found', async ({
    page,
  }) => {
    await page.goto('/en/shop/sreyleak-bakery');
    await expect(page.getByRole('heading', { name: /Sreyleak Bakery/ }).first()).toBeVisible({
      timeout: 20_000,
    });
    await page.goto('/en/shop/no-such-shop-anywhere');
    await expect(page.getByRole('heading', { name: 'Shop not found' })).toBeVisible({
      timeout: 20_000,
    });
  });
});
