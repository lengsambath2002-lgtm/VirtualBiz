import { expect as baseExpect, test, type Page } from '@playwright/test';

import { DANA, signIn, trackErrors } from './_helpers/app';

const expect = baseExpect.configure({ timeout: 20_000 });

/** Fill the shop policy panel and save it. */
async function setPolicy(page: Page, footer: string, vat: string, card: boolean) {
  await page.goto('/en/seller/settings?section=receipts');
  const panel = page.getByRole('region', { name: 'Receipts, VAT and payments' });
  await panel.getByLabel('Receipt footer').fill(footer);
  await panel.getByLabel('VAT rate (%)').fill(vat);
  await panel.getByRole('checkbox', { name: /^Card/ }).setChecked(card);
  const save = panel.getByRole('button', { name: 'Save' });
  // Already set (an earlier run stopped before putting the defaults back): nothing to save.
  if (await save.isDisabled()) return;
  await save.click();
  await expect(panel.getByRole('status')).toHaveText('Saved');
}

test.describe('Shop settings', () => {
  test('receipt text, VAT and accepted payment methods reach the register', async ({ page }) => {
    const errors = trackErrors(page);
    await signIn(page, '/seller/settings');
    await setPolicy(page, 'Exchange within 14 days with this receipt.', '10', false);

    await page.goto('/en/seller/pos');
    const tile = page.getByRole('button', { name: /USB-C to USB-C Cable/ }).first();
    await expect(tile).toBeVisible();
    const open = page.getByRole('dialog').getByRole('button', { name: /Open shift|Open/ });
    await tile.click();
    if (await open.isVisible().catch(() => false)) {
      await open.click();
      await tile.click();
    }
    await page.getByRole('button', { name: /^Charge \$/ }).click();
    const charge = page.getByRole('dialog');
    await expect(charge.getByRole('button', { name: 'Cash', exact: true })).toBeVisible();
    await expect(charge.getByRole('button', { name: 'Card', exact: true })).toHaveCount(0);
    await charge.getByRole('button', { name: /exact/i }).first().click();
    await charge.getByRole('button', { name: 'Complete sale' }).click();
    const receipt = page.getByRole('dialog');
    await expect(receipt.getByText(/R-\d{5,}/)).toBeVisible();
    await expect(receipt.getByText('VAT 10% included')).toBeVisible();
    await expect(receipt.getByText('Exchange within 14 days with this receipt.')).toBeVisible();
    await page.getByRole('button', { name: 'New sale' }).click();

    // Back to the defaults for the other tests.
    await setPolicy(page, '', '0', true);
    expect(errors).toEqual([]);
  });

  test('a provider sets start times and the public booking slots follow', async ({ page }) => {
    const errors = trackErrors(page);
    await signIn(page, '/provider/settings', DANA);
    await page.getByRole('link', { name: /^Booking rules/ }).click();
    const slot = page.getByLabel('Start times');
    await slot.selectOption({ label: 'Every 15 min' });
    await expect(page.getByText('Saved', { exact: true }).first()).toBeVisible();
    const avail = await page.request.get('/api/marketplace/items/glow-cut/availability?days=1');
    expect((await avail.json()).data.step).toBe(15);

    await slot.selectOption({ label: 'Every 30 min' });
    await expect(page.getByText('Saved', { exact: true }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('on a phone, settings is a list and each section opens on its own @phone', async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await signIn(page, '/seller/settings');
    const menu = page.getByRole('navigation', { name: 'Settings sections' });
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
    await expect(page.getByLabel('Shop name')).toBeHidden();

    await menu.getByRole('link', { name: /^Delivery/ }).click();
    await expect(page).toHaveURL(/section=delivery/);
    await expect(page.getByRole('heading', { name: 'Delivery zones' })).toBeVisible();
    await expect(menu).toBeHidden();

    await page.getByRole('link', { name: 'Settings', exact: true }).last().click();
    await expect(menu.getByRole('link', { name: /^Payments and payouts/ })).toBeVisible();
    await expect(menu.getByRole('link', { name: /^Team and roles/ })).toHaveAttribute(
      'href',
      '/en/seller/team',
    );
    expect(errors).toEqual([]);
  });
});
