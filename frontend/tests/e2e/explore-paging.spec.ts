import { expect, test } from '@playwright/test';

// Explore loads 24 results at a time as the customer scrolls (docs/api/phase2-catalog-inventory.md
// § Search), says how many are shown, recovers from a failed page and ends with "That's all".
test('Explore loads more as you scroll and says when everything is shown', async ({ page }) => {
  await page.goto('/en/search');
  const status = page.getByText(/^Showing \d+ of \d+$/);
  await expect(status).toBeVisible({ timeout: 20_000 });
  const total = Number((await status.textContent())!.match(/of (\d+)/)![1]);
  expect(total).toBeGreaterThan(24);
  await expect(status).toHaveText(`Showing 24 of ${total}`);

  // A page that fails says so and retries in place.
  let fail = true;
  await page.route('**/marketplace/search**page=1**', (r) =>
    fail ? r.fulfill({ status: 503, body: '' }) : r.continue(),
  );
  await page.getByRole('button', { name: 'Show more' }).click();
  await expect(page.getByText("Couldn't load more results.")).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(status).toHaveText(`Showing 48 of ${total}`);

  // Scrolling to the end loads the rest.
  for (let i = 0; i < 20 && !(await page.getByText(/^That's all \d+ results$/).isVisible()); i++) {
    await page.mouse.wheel(0, 5000);
    await page.waitForTimeout(500);
  }
  await expect(page.getByText(`That's all ${total} results`)).toBeVisible();
  await page.getByRole('button', { name: 'Back to top' }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(50);
});
