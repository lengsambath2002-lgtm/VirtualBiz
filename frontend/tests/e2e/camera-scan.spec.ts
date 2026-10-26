import { expect, test, type Page } from '@playwright/test';

import { signIn, trackErrors } from './_helpers/app';

// The phone camera as a barcode scanner. Chromium's fake camera stands in for a real one, and a
// stand-in BarcodeDetector "sees" the USB-C cable's barcode after a few frames.
test.use({
  permissions: ['camera'],
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  },
});

const CABLE = /USB-C to USB-C Cable/;

/** A BarcodeDetector that reads `window.__scanCode` every sixth frame (once a test sets it). */
async function fakeDetector(page: Page) {
  await page.addInitScript(() => {
    let frames = 0;
    class FakeDetector {
      static async getSupportedFormats() {
        return ['ean_13', 'code_128', 'qr_code'];
      }
      async detect() {
        frames += 1;
        const code = (window as unknown as { __scanCode?: string }).__scanCode;
        return code && frames % 6 === 5 ? [{ rawValue: code }] : [];
      }
    }
    (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = FakeDetector;
  });
}

/** The cable's barcode, from the Scan dialog's "Try …" line; closes the dialog. */
async function cableBarcode(page: Page) {
  await page.getByRole('button', { name: 'Scan barcode' }).click();
  const dialog = page.getByRole('dialog');
  const code = (await dialog.getByRole('button', { name: /^\d{8,}$/ }).textContent())!.trim();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  return code;
}

const point = (page: Page, code: string) =>
  page.evaluate((c) => ((window as unknown as { __scanCode?: string }).__scanCode = c), code);

test('Scan opens the camera and shows the product it reads @phone', async ({ page }) => {
  const errors = trackErrors(page);
  await fakeDetector(page);
  await signIn(page, '/seller/inventory');
  const code = await cableBarcode(page);
  await page.getByRole('button', { name: 'Scan barcode' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Camera', { exact: true })).toBeVisible();
  await point(page, code);
  await expect(dialog.getByText(CABLE).first()).toBeVisible({ timeout: 10_000 });
  await expect(dialog.getByLabel('Barcode or SKU')).toHaveValue(code);
  // The camera rests while the result shows; "Scan another" turns it back on.
  await expect(dialog.getByLabel('Camera', { exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Scan another' }).click();
  await expect(dialog.getByLabel('Camera', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('on the register, each code the camera reads goes into the sale', async ({ page }) => {
  const errors = trackErrors(page);
  await fakeDetector(page);
  await signIn(page, '/seller/pos');
  const open = page.getByRole('dialog').getByRole('button', { name: /Open shift|Open/ });
  if (await open.isVisible({ timeout: 3_000 }).catch(() => false)) await open.click();
  const code = await cableBarcode(page);
  await page.getByRole('button', { name: 'Scan with the camera' }).click();
  await expect(page.getByLabel('Camera', { exact: true })).toBeVisible();
  await point(page, code);
  await expect(page.getByText(/USB-C to USB-C Cable.* added/).first()).toBeVisible({
    timeout: 10_000,
  });
  // Held in view, the same barcode is one item; it counts again only once taken away.
  await page.waitForTimeout(3_000);
  await expect(page.locator('#poscart').getByText('1 item', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Turn the camera off' }).click();
  await expect(page.getByLabel('Camera', { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});
