import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { DANA, signIn } from './_helpers/app';

// Phase 14 (docs/api/phase14-customers-exports.md): shops correct customer records and take
// their data out as CSV.

test('a seller edits a customer and downloads customers as CSV', async ({ page }) => {
  await signIn(page, '/seller/customers');
  const row = page.locator('tbody tr[tabindex="0"]').first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.click();
  const drawer = page.getByRole('dialog').first();
  await drawer.getByRole('button', { name: 'Edit details' }).click();
  const form = page.getByRole('dialog', { name: /^Edit / });
  const note = `Prefers pickup ${Date.now().toString(36)}`;
  await form.getByLabel('Private note').fill(note);
  await form.getByLabel('District').selectOption('Daun Penh');
  await form.getByRole('button', { name: 'Save changes' }).click();
  await expect(form).toBeHidden();
  await expect(page.getByText(note)).toBeVisible();

  await page.goto('/en/seller/settings?section=data');
  const panel = page.getByRole('region', { name: 'Export data' });
  await expect(panel).toBeVisible({ timeout: 20_000 });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    panel.getByRole('button', { name: 'Download Customers as CSV' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^nita-gadget.*-customers-\d{4}-\d\d-\d\d\.csv$/);
  const csv = readFileSync((await download.path())!, 'utf8');
  expect(csv.startsWith('﻿"Name","Phone"')).toBe(true);
  expect(csv).toContain(note);
  await expect(panel.getByRole('status')).toContainText('Downloaded');
});

test('a provider downloads bookings for a period', async ({ page }) => {
  await signIn(page, '/provider/settings?section=data', DANA);
  const panel = page.getByRole('region', { name: 'Export data' });
  await expect(panel).toBeVisible({ timeout: 20_000 });
  await panel.getByRole('button', { name: /^Period: / }).click();
  await page
    .getByRole('dialog', { name: 'Period' })
    .getByRole('button', { name: 'Last 90 days' })
    .click();
  await expect(panel.getByRole('button', { name: 'Period: Last 90 days' })).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    panel.getByRole('button', { name: 'Download Bookings as CSV' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(
    /-appointments-\d{4}-\d\d-\d\d_\d{4}-\d\d-\d\d\.csv$/,
  );
  const csv = readFileSync((await download.path())!, 'utf8');
  expect(csv.split('\r\n')[0]).toContain('"Booking","Date","Start"');
});
