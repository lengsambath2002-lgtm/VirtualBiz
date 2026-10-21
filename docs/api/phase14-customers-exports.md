# API Phase 14: customer records and data exports

A shop corrects its customer records and takes its data out for a spreadsheet or an accountant.

## Editing a customer

`PATCH /api/clients/{id}` (any member of the shop, product or service) takes any of `name`
(2–80), `phone` (a Cambodian number, unique in the shop: **DUPLICATE_CLIENT**, else
**INVALID_PHONE**), `email`, `district` (a known district: **DISTRICT_NOT_FOUND**) and `note` (up
to 500). Only the fields sent change; an empty `email`, `district` or `note` clears it.

The seller's customer drawer (**Edit details**) and the provider's client drawer (**Edit**) open the
same dialog (`features/business-customers`). The seller workspace keeps the client record's id as
`clientId`, because a customer with an account is listed by their account id.

## CSV exports

`GET /api/exports/{kind}?from=YYYY-MM-DD&to=YYYY-MM-DD` with `X-Business-Id`, **owner or manager**
(staff get **FORBIDDEN**: the files hold customers' details).

| kind | Shops | Period | One row per |
|---|---|---|---|
| `orders` | product | placed in the period | order: number, placed, status, customer, phone, fulfilment, address, district, items, quantity, subtotal, discount, promo code and discount, delivery fee, total, cancel reason |
| `products` | product | none (now) | live variant: product, variant, SKU, barcode, collection, category, price, compare-at, cost, stock, sold |
| `sales` | both | rung up in the period | receipt: number, time, cashier, customer, items, subtotal, discount and reason, tip, total, payments, refunded |
| `appointments` | service | visit day in the period | booking: number, date, start, end, service, staff, client, phone, status, source, price, note, cancel reason |
| `customers` | both | none (all) | customer: name, phone, email, district, note, since, has an account |

- Days are Phnom Penh days. Without `from` / `to` the period is the last 30 days to today. `from`
  after `to`, or more than 366 days, is **VALIDATION_FAILED**; an unknown `kind` too. A kind for the
  other type of shop is **WRONG_BUSINESS_TYPE**.
- The answer is `text/csv; charset=UTF-8` with `Content-Disposition: attachment;
  filename="{shop-slug}-{kind}-{from}_{to}.csv"` (undated kinds: `-{today}`), `Cache-Control:
  no-store` and `X-Row-Count`.
- The file starts with a UTF-8 byte-order mark (Excel then shows Khmer), uses CRLF, quotes every
  text cell, and puts an apostrophe before text starting with `= + - @`, tab or CR so a spreadsheet
  never runs it as a formula. Amounts are USD with two decimals; times are `yyyy-MM-dd HH:mm`
  Phnom Penh.
- Every export is logged (`EXPORT {kind} business=… by=… rows=… range=…`).

**Settings → Export data** in both workspaces picks a period (last 7 / 30 / 90 days, this month,
last month, last 12 months) and downloads each file; staff see why they can't.
