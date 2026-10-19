import { expect, test, type Page } from '@playwright/test';

import { createAccount, DANA, forgetSession, signIn, trackErrors } from './_helpers/app';

// Phase 2: catalogue, inventory, marketplace search and saved items, all through the live API
// (docs/api/phase2-catalog-inventory.md).

interface SearchItem {
  type: 'PRODUCT' | 'SERVICE';
  slug: string;
  shopSlug: string;
  title?: string;
  variants?: { price: number; stock: number }[];
}

/** The listing's slug, found through the public search API. */
async function slugOf(page: Page, title: string) {
  const res = await page.request.get(`/api/marketplace/search?q=${encodeURIComponent(title)}`);
  const items = (await res.json()).data.items as SearchItem[];
  const hit = items.find((i) => i.title === title);
  expect(hit, `listing "${title}"`).toBeTruthy();
  return hit!.slug;
}

/** Open the customer product page in a fresh tab (a full load: the server's live stock). */
async function customerStock(page: Page, slug: string) {
  const tab = await page.context().newPage();
  await tab.goto(`/en/p/${slug}`);
  const text = tab.getByText(/· (only \d+ left|\d+ available)/).first();
  await expect(text).toBeVisible({ timeout: 20_000 });
  return { tab, text };
}

test.describe('Seller catalogue → customer marketplace', () => {
  test('create and edit a product, adjust and undo stock; the customer page follows', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const errors = trackErrors(page);
    const title = `E2E Desk Lamp ${Date.now().toString(36)}`;

    await signIn(page, '/seller/products/new');
    await page.getByLabel('Title').fill(title);
    await page.getByLabel('Category').selectOption('Accessories');
    await page.getByLabel('Status').selectOption('ACTIVE');
    await page.getByLabel('Price', { exact: true }).fill('19.5');
    await page.getByLabel('Opening stock').fill('7');
    await page.getByRole('button', { name: 'Save product' }).click();
    await expect(page.getByText(`${title} is live on VirtualBiz`)).toBeVisible();
    await expect(page).toHaveURL(/\/en\/seller\/products\/[0-9a-f-]{36}$/);

    const slug = await slugOf(page, title);
    let shown = await customerStock(page, slug);
    await expect(shown.tab.getByRole('heading', { name: title })).toBeVisible();
    await expect(shown.text).toHaveText('· 7 available');
    await shown.tab.close();

    // Edit: a new price is what customers see.
    await page.getByLabel('Price', { exact: true }).fill('21');
    await page.getByRole('button', { name: 'Save', exact: true }).first().click();
    await expect(page.getByText('Product saved')).toBeVisible();
    const after = await page.request.get(`/api/marketplace/items/${slug}`);
    expect((await after.json()).data.variants[0].price).toBe(21);

    // Receive 3 → 10 on the customer page.
    await page.goto(`/en/seller/inventory?q=${encodeURIComponent(title)}`);
    await page.getByRole('button', { name: 'Adjust', exact: true }).click();
    await page.getByLabel('Quantity received').fill('3');
    await page.getByRole('button', { name: 'Save adjustment' }).click();
    await expect(page.getByRole('status')).toContainText('10 in stock');
    shown = await customerStock(page, slug);
    await expect(shown.text).toHaveText('· 10 available');
    await shown.tab.close();

    // Damaged 4 → 6, then Undo → back to 10, on the server too.
    await page.getByRole('button', { name: 'Adjust', exact: true }).click();
    await page.getByLabel('Damaged / lost').check();
    await page.getByLabel('Quantity damaged or lost').fill('4');
    await page.getByRole('button', { name: 'Save adjustment' }).click();
    await expect(page.getByRole('status')).toContainText('6 in stock');
    await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
    await expect(
      page.getByRole('row', { name: new RegExp(title) }).getByText('10', { exact: true }),
    ).toBeVisible();
    await expect
      .poll(async () => {
        const r = await page.request.get(`/api/marketplace/items/${slug}`);
        return (await r.json()).data.variants[0].stock as number;
      })
      .toBe(10);
    shown = await customerStock(page, slug);
    await expect(shown.text).toHaveText('· 10 available');
    await shown.tab.close();

    // A reload shows the server's log: the receipt is there, the undone loss is not.
    await page.reload();
    const log = page.getByRole('table').nth(1);
    await expect(log.getByRole('row', { name: new RegExp(`${title}.*Received`) })).toBeVisible();
    await expect(log.getByRole('row', { name: new RegExp(`${title}.*Damaged`) })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test.describe('Search runs on the API', () => {
  test('category filter, price sort and nearest-first come from the server', async ({ page }) => {
    const searched = (pred: (u: URL) => boolean) =>
      page.waitForResponse((r) => {
        if (!r.url().includes('/api/marketplace/search')) return false;
        return pred(new URL(r.url()));
      });

    let res = searched((u) => u.searchParams.get('category') === 'spa');
    await page.goto('/en/search?type=service&category=spa');
    let body = await (await res).json();
    expect(body.data.items.map((i: SearchItem) => i.slug).sort()).toEqual([
      'footspa',
      'khmer',
      'massage',
    ]);
    await expect(page.getByText('3 results')).toBeVisible();
    await expect(page.getByText('Aromatherapy Massage')).toBeVisible();

    res = searched((u) => u.searchParams.get('sort') === 'low');
    await page.goto('/en/search?type=product&max=3&sort=low');
    body = await (await res).json();
    const prices = body.data.items.map((i: SearchItem) => i.variants![0]!.price);
    expect(prices.length).toBeGreaterThan(1);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
    expect(Math.max(...prices)).toBeLessThanOrEqual(3);
    // The first card is the cheapest listing.
    await expect(page.locator('a[href*="/p/"]').first()).toHaveAttribute(
      'href',
      new RegExp(`/p/${body.data.items[0].slug}$`),
    );

    // Nearest first, from the customer's district (Toul Kork by default).
    res = searched((u) => u.searchParams.get('sort') === 'near');
    await page.goto('/en/search?type=product&sort=near');
    const near = await res;
    const url = new URL(near.url());
    expect(url.searchParams.get('district')).toBe('Toul Kork');
    expect(url.searchParams.get('lat')).toBeTruthy();
    body = await near.json();
    expect(body.data.items[0].shopSlug).toBe('happy-coffee');
    await expect(page.locator('a[href*="/p/"]').first()).toHaveAttribute(
      'href',
      new RegExp(`/p/${body.data.items[0].slug}$`),
    );
  });
});

test.describe('Saved items and followed shops (API)', () => {
  test('a heart and a follow survive a reload and a new sign-in', async ({ page, request }) => {
    const account = await createAccount(request, 'Mealea Saver');
    await signIn(page, '/p/latte', account);
    // The product page's own heart (the "More from this shop" cards have one too).
    await page.getByRole('button', { name: 'Save', exact: true }).first().click();
    await expect(page.getByRole('button', { name: 'Remove from saved' }).first()).toBeVisible();
    await page.goto('/en/shop/fresh-mart');
    await page.getByRole('button', { name: 'Follow' }).click();
    await expect(page.getByRole('button', { name: 'Following' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: 'Following' })).toBeVisible();

    // Another device: nothing in localStorage, same account.
    await forgetSession(page);
    await page.evaluate(() => localStorage.clear());
    await signIn(page, '/account/saved', account);
    await expect(page.getByText('Iced Mondulkiri Latte')).toBeVisible();
    await page.getByRole('tab', { name: /Shops/ }).click();
    await expect(page.getByText('Fresh Mart')).toBeVisible();

    // Unsave from the saved list.
    await page.getByRole('tab', { name: /Items/ }).click();
    await page.getByRole('button', { name: 'Remove from saved' }).first().click();
    await expect(page.getByText('Nothing saved yet')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Nothing saved yet')).toBeVisible();
  });
});

test.describe('Provider services (API)', () => {
  test('a service added in the workspace is bookable by customers, then deleted', async ({
    page,
  }) => {
    const name = `Brow Tint ${Date.now().toString(36).slice(-4)}`;
    await signIn(page, '/provider/services', DANA);
    await page.getByRole('button', { name: 'Add service' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill(name);
    await dialog.getByLabel('Category').selectOption('Make-up');
    await dialog.getByLabel('Price').fill('9');
    await dialog.getByText('Try', { exact: false }).first().click();
    await dialog.getByRole('button', { name: 'Add service' }).click();
    await expect(page.getByText(`${name} added`)).toBeVisible();

    const search = await page.request.get(`/api/marketplace/search?q=${encodeURIComponent(name)}`);
    const hit = ((await search.json()).data.items as SearchItem[])[0]!;
    expect(hit.shopSlug).toBe('glow-beauty');
    const tab = await page.context().newPage();
    await tab.goto(`/en/s/${hit.slug}`);
    await expect(tab.getByRole('heading', { name })).toBeVisible({ timeout: 20_000 });
    await tab.close();

    // A reload keeps it (the list comes from the API); deleting removes it there too.
    await page.reload();
    await page.getByRole('button', { name: `Delete ${name}` }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Service deleted')).toBeVisible();
    await expect
      .poll(async () => (await page.request.get(`/api/marketplace/items/${hit.slug}`)).status())
      .toBe(404);
  });
});
