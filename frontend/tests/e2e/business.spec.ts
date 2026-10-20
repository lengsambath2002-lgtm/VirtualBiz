import { expect as baseExpect, type Page, test } from '@playwright/test';
import path from 'node:path';

import { createAccount, forgetSession, signIn, trackErrors } from './_helpers/app';

const expect = baseExpect.configure({ timeout: 20_000 });
const ID_PHOTO = path.join(__dirname, '_helpers/id-card.png');

/** Fill the three Create Business steps and open the shop. */
async function createBusiness(
  page: Page,
  type: 'products' | 'bookings',
  name: string,
  cat: string,
) {
  await page.getByText(type === 'products' ? 'I sell products' : 'I take bookings').click();
  await page.getByLabel('Shop name').fill(name);
  await page.getByRole('button', { name: cat }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Street or landmark').fill('#12, St. 516');
  await page.getByLabel('Phone for customers').fill('012345678');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Your Bakong ID').fill('leng@aba');
  await page.locator('input[type=file]').setInputFiles(ID_PHOTO);
  await page.getByRole('button', { name: 'Open my shop' }).click();
  await expect(page.getByRole('heading', { name: `${name} is open!` })).toBeVisible();
}

async function openSwitcher(page: Page) {
  await page
    .getByRole('button', { name: /^account$/i })
    .first()
    .click();
  await page.getByRole('menuitem', { name: 'Switch to shop' }).click();
  return page.getByRole('menu');
}

test.describe('Create a business and switch to it', () => {
  test('a new product shop opens its own empty workspace and joins the switcher', async ({
    page,
  }) => {
    const errors = trackErrors(page);
    const name = `Leng Phone ${Date.now().toString(36)}`;
    await signIn(page, '/home');
    const menu = await openSwitcher(page);
    await menu.getByRole('menuitem', { name: 'Create a new business' }).click();
    await expect(page).toHaveURL(/\/en\/create-business$/);
    await createBusiness(page, 'products', name, 'Phones & electronics');

    await page.getByRole('button', { name: 'Go to my shop' }).click();
    await expect(page).toHaveURL(/\/en\/seller/);
    await expect(page.getByText(name).first()).toBeVisible();
    // Its own workspace: nothing from the demo shop.
    await expect(page.getByText('Nita Gadget Store')).toHaveCount(0);

    // Listed as an owned business; switching to the demo shop and back keeps them apart.
    await page
      .getByRole('button', { name: /account/i })
      .last()
      .click();
    const sw = page.getByRole('menu', { name: 'Switch profile' });
    await expect(sw.getByRole('menuitemradio', { name: new RegExp(name) })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await sw.getByRole('menuitemradio', { name: /Nita Gadget Store/ }).click();
    await expect(page.getByText('Nita Gadget Store').first()).toBeVisible();
    await page
      .getByRole('button', { name: /account/i })
      .last()
      .click();
    await page
      .getByRole('menu', { name: 'Switch profile' })
      .getByRole('menuitemradio', { name: new RegExp(name) })
      .click();
    await expect(page.getByText(name).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('a new service business opens the provider workspace; "create" starts fresh', async ({
    page,
  }) => {
    const name = `Leng Nails ${Date.now().toString(36)}`;
    await signIn(page, '/home');
    await page.goto('/en/create-business?new=1');
    await createBusiness(page, 'bookings', name, 'Nails');
    await page.getByRole('button', { name: 'Go to my shop' }).click();
    await expect(page).toHaveURL(/\/en\/provider/);
    await expect(page.getByText(name).first()).toBeVisible();

    // Creating another business starts at step 1, not on the last one's done screen.
    await page.goto('/en/create-business?new=1');
    await expect(page.getByRole('heading', { name: "What's your business?" })).toBeVisible();
    await expect(page.getByLabel('Shop name')).toHaveValue('');
  });
});

test.describe('Create Business ✕', () => {
  test('closes to home, keeps the draft, and resumes it', async ({ page }) => {
    await signIn(page, '/home');
    await page.goto('/en/create-business?new=1');
    await expect(page.getByLabel('Shop name')).toBeVisible();
    await page.getByLabel('Shop name').fill('Half-done Shop');
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByText(/Saved\. Continue any time/)).toBeVisible();
    await expect(page).toHaveURL(/\/en\/home$/);

    await page.goto('/en/create-business?new=1');
    await expect(page.getByLabel('Shop name')).toHaveValue('Half-done Shop');
  });
});

test.describe('One account, many shops', () => {
  test('after opening a shop, "Create a new business" starts the next one', async ({
    page,
    request,
  }) => {
    const errors = trackErrors(page);
    const owner = await createAccount(request, 'Leng Sambath');
    const first = `LSB ${Date.now().toString(36)}`;
    const second = `LSB Two ${Date.now().toString(36)}`;
    await signIn(page, '/home', owner);
    await page.goto('/en/create-business');
    await createBusiness(page, 'products', first, 'Phones & electronics');

    // Back to Create Business without ?new=1 (the switcher's link): a blank form, not the
    // first shop's done screen.
    await page.goto('/en/create-business');
    await expect(page.getByRole('heading', { name: "What's your business?" })).toBeVisible();
    await expect(page.getByLabel('Shop name')).toHaveValue('');
    await createBusiness(page, 'bookings', second, 'Nails');

    // Both are the owner's.
    const login = await request.post('/api/auth/login', { data: owner });
    const token = (await login.json()).data.accessToken as string;
    const mine = await request.get('/api/me/businesses', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const names = ((await mine.json()).data as { name: string }[]).map((x) => x.name);
    expect(names.sort()).toEqual([first, second].sort());
    expect(errors).toEqual([]);
  });

  test('another account on the same browser starts blank and really creates its shop', async ({
    page,
    request,
  }) => {
    const a = await createAccount(request, 'Leng Sambath');
    const b = await createAccount(request, 'Leng Tang');
    const shopA = `Sambath Shop ${Date.now().toString(36)}`;
    const shopB = `Tang Boxing ${Date.now().toString(36)}`;
    await signIn(page, '/home', a);
    await page.goto('/en/create-business');
    await createBusiness(page, 'products', shopA, 'Phones & electronics');

    // B signs in on the same browser: A's draft (and A's open shop) are not B's.
    await forgetSession(page);
    await signIn(page, '/home', b);
    await page.goto('/en/create-business');
    await expect(page.getByRole('heading', { name: "What's your business?" })).toBeVisible();
    await expect(page.getByLabel('Shop name')).toHaveValue('');
    await createBusiness(page, 'bookings', shopB, 'Nails');

    // The shop exists on the server and belongs to B.
    const login = await request.post('/api/auth/login', { data: b });
    const token = (await login.json()).data.accessToken as string;
    const list = await request.get('/api/me/businesses', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const names = ((await list.json()).data as { name: string }[]).map((x) => x.name);
    expect(names).toEqual([shopB]);
  });
});
