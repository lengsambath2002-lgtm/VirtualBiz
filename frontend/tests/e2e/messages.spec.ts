import { expect, test, type APIRequestContext } from '@playwright/test';

import { createAccount, DANA, signIn, type Account } from './_helpers/app';

// Phase 13 (docs/api/phase13-messages.md): receipts go out as a real link anyone can open, and a
// salon's decline message reaches the customer.

test('a POS receipt is shared as a public link', async ({ page, browser }) => {
  await signIn(page, '/seller/pos');
  const tile = page.getByRole('button', { name: /USB-C to USB-C Cable/ }).first();
  await expect(tile).toBeVisible({ timeout: 20_000 });
  const open = page.getByRole('dialog').getByRole('button', { name: /Open shift|Open/ });
  await tile.click();
  if (await open.isVisible().catch(() => false)) {
    await open.click();
    await tile.click();
  }
  await page.getByRole('button', { name: /^Charge \$/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: /exact/i }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Complete sale' }).click();
  const receipt = page.getByRole('dialog');
  await expect(receipt.getByText(/R-\d{5,}/)).toBeVisible({ timeout: 20_000 });
  const number = (await receipt.getByText(/R-\d{5,}/).innerText()).trim();

  // Telegram's share link carries the receipt's public address.
  const telegram = receipt.getByRole('link', { name: 'Telegram' });
  await expect(telegram).toHaveAttribute('href', /t\.me\/share\/url\?url=.*%2Fr%2F/, {
    timeout: 20_000,
  });
  const href = decodeURIComponent((await telegram.getAttribute('href'))!);
  const path = new URL(href.match(/url=([^&]+)/)![1]!).pathname;

  // Opened by someone who isn't signed in.
  const guest = await (await browser.newContext()).newPage();
  await guest.goto(path);
  await expect(guest.getByText(number)).toBeVisible({ timeout: 20_000 });
  await expect(guest.getByText('Nita Gadget Store').first()).toBeVisible();
  await expect(guest.getByText(/USB-C to USB-C Cable/)).toBeVisible();

  // An unknown token is "not found", not a blank page.
  await guest.goto('/en/r/not-a-real-token-123');
  await expect(guest.getByRole('heading', { name: /not found/i })).toBeVisible({ timeout: 20_000 });
  await guest.close();
});

/** A request for Spa Pedicure on the first later day with a free staff slot, made through the API. */
async function requestBooking(request: APIRequestContext, account: Account, name: string) {
  const login = await request.post('/api/auth/login', { data: account });
  const token = (await login.json()).data.accessToken as string;
  const avail = (
    await (await request.get('/api/marketplace/items/glow-pedi/availability?days=14')).json()
  ).data as { days: { date: string; slots: { start: number; staffIds: string[] }[] }[] };
  const slot = avail.days
    .slice(2)
    .flatMap((d) => d.slots.filter((s) => s.staffIds.length).map((s) => ({ date: d.date, ...s })))
    .at(-1)!;
  const res = await request.post('/api/me/bookings', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      service: 'glow-pedi',
      staffId: slot.staffIds[0],
      date: slot.date,
      start: slot.start,
      name,
      phone: `09${String(Date.now()).slice(-8)}`,
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
  return (await res.json()).data.number as string;
}

test("the salon's decline message reaches the customer", async ({ page, browser, request }) => {
  const who = `Vanna ${Date.now().toString(36).slice(-5)}`;
  const account = await createAccount(request, who);
  const number = await requestBooking(request, account, who);
  const note = `Fully booked that day, sorry. Try us next week (${number}).`;

  const salon = await (await browser.newContext({ timezoneId: 'Asia/Phnom_Penh' })).newPage();
  await signIn(salon, '/provider/calendar', DANA);
  await salon.getByRole('link', { name: 'Home' }).first().click();
  const row = salon
    .locator('div')
    .filter({ hasText: who })
    .filter({ has: salon.getByRole('button', { name: 'Decline' }) })
    .last();
  await row.getByRole('button', { name: 'Decline' }).click();
  const dialog = salon.getByRole('dialog');
  await dialog.getByLabel('Message').fill(note);
  await dialog.getByRole('button', { name: 'Decline & send' }).click();
  await expect(salon.getByText('Declined. Message sent.')).toBeVisible();
  await salon.close();

  await signIn(page, `/bookings/${number}`, account);
  await expect(page.getByText('Declined').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('decline-message')).toHaveText(note);
});
