# API Phase 16: shop lists, imports and exports

The shop workspaces stop relying on what the browser loaded: every order and every customer is
reachable a page at a time, and shops bring data in from CSV as well as take it out. Lists follow
the contract of docs/api/phase15-lists.md (`page`, `size`, `sort`, `from` / `to`).

## Order history (product shops, any member)

`GET /api/orders/history`: `tab` (new/pack/ship/done/cancelled/all), `q` (number, customer name,
phone digits, item title), `method` (DELIVERY/PICKUP), `pay` (KHQR/CARD/CASH, online payments),
`source` (ONLINE/PHONE/FACEBOOK/TELEGRAM/WALK_IN), placed `from` / `to`; sort `placed`, `total`,
`number` (default `-placed`). Built with JPA specifications (`OrderSpecs`); the same filters drive
`GET /api/exports/orders` (which also takes `tab`, `q`, `method`, `pay`, `source`), so the CSV is
the list on screen.

The Orders page keeps New / To pack / To ship live from the workspace; Done, Cancelled and All are
this paged history. Opening an older order adds it to the workspace so its drawer and actions work.

## Customers (both kinds of shop, any member)

`GET /api/clients/page`: `q` (name, email, phone digits), `district`, `segment`
(vip/new/risk/noshow), `account` (yes/no), joined `from` / `to`; sort `name` (default), `spent`,
`last`, `since`, `orders`, `visits`. Each row has lifetime numbers computed in SQL
(`ClientQueries`): `orders` (placed orders matched by account or phone), `visits` and `noShows`
(appointments), `spent` (delivered / picked-up orders plus counter sales), `lastAt`, `nextVisit`, and
`segment`: **vip** = top 20% by spend, **new** = joined in the last 30 days, **risk** = no visit for
3 weeks and nothing booked (the prototype's rules, now over all history instead of the browser's
60/90-day window).

`POST /api/clients` now works for product shops too and takes `district`.

## CSV imports (owner or manager)

`POST /api/imports/{products|customers}?dryRun=true|false&skipInvalid=true|false` with
`{rows: [{column: value}]}` (≤ 5,000 rows; the browser reads the file). The answer is
`{total, created, updated, skipped, errors: [{line, field, message}], applied}`; `line` is the
spreadsheet row (2 = first data row). The file is checked whole first; with problems nothing is
written unless `skipInvalid=true`, which writes the good rows only.

- **products** (product shops): the product export's columns. A row whose SKU the shop has updates
  that variant's price, compare-at, cost and barcode; `Stock` is the counted stock, and the
  difference goes through the stock writer as a `COUNT_CORRECTION` ("CSV import"). A row with a new
  or no SKU and no `Variant` creates a one-variant product (`Status` Active/Draft, default Active).
  Duplicate SKUs or barcodes in the file, unknown variants and bad numbers are row errors.
- **customers** (both): `Name`, `Phone` (required), `Email`, `District`, `Note`. The phone matches an
  existing customer (updated; blank cells leave fields as they are) or adds a new one.

## Sales, receipts and appointments

- `GET /api/sales/history` (service providers) and `GET /api/pos/sales/history` (product shops,
  the register's `R-` receipts): `q` (receipt number or customer), `pay` (CASH/KHQR/CARD), `cashier`,
  `refunded` (yes/no), `from` / `to`; sort `at` (default `-at`), `total`, `number` (`SaleSpecs`).
- `GET /api/appointments/list` (service providers): `status`, `staffId`, `serviceId`, `source`,
  `from` / `to` (visit day), `q` (booking number, client name or phone digits); sort `when`
  (default `-when`: day then start time), `price`, `number` (`AppointmentSpecs`). The calendar's own
  `GET /api/appointments?from&to` is unchanged; the calendar now asks for any day or week outside the
  60-days-back / 90-ahead window it loads at start.
- `POST /api/appointments/bulk-status` `{refs (≤ 100 ids or numbers), status: {status, reason?,
  message?}}` → `{done, failed: [{id, code, message}]}`: each through the single status change (rules,
  clash check, notifications). `BulkResult` now lives in `common.list` (the console's bulk actions
  use it too).

## Screens

- Seller **Products**: Export, Import CSV, and row selection with Publish / Move to draft / Delete.
- Seller **Customers** and provider **Clients**: the shared `CustomerList` (segments, filters in
  the URL, sortable lifetime columns, pages, Add customer, Import CSV, Export).
- Seller **Orders**: history tabs as above, with Export of the filtered view (up to a year).
- Seller **Register → Receipts**: any day, or a search over all receipts, paged; an older receipt
  opens for reprint, share or refund.
- Seller **Reviews** (waiting for a reply / replied, stars, search) and **Promotions** (status with
  counts, search) filter with their state in the URL.
- Provider **Sales**: the transactions table is the paged history (was the latest 40 of 90 days).
- Provider **Calendar → List**: every appointment with filters, export, and "Accept N requests" for
  selected requests; the requests drawer has "Accept all without a clash".
