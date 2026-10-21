# API Phase 17: stock history, the whole inbox, bulk service switches, saved views

The remaining lists follow the contract of docs/api/phase15-lists.md (`page`, `size`, `sort`,
`from` / `to`).

## Stock history (product shops, any member)

`GET /api/inventory/movements/history`: `reason` (a `StockReason`), `direction` (`in` / `out`),
`productId`, `variantId`, `q` (product title, SKU or barcode), `from` / `to`; sort `at` (default
`-at`), `delta` (`MovementSpecs`). `GET /api/exports/movements?from&to` is the CSV (time, product,
variant, SKU, change, reason, note, by). Only the inventory package reads the movement log
(ArchitectureTest), so the export asks `InventoryService.movementsForExport`.

Inventory's **Stock history** panel (was "Recent changes": 8 rows, 40 at most) is this list with
direction tabs, reason, search, dates, pages and export.

## The whole inbox (shops)

`GET /api/notifications/history?unread=true|false&kind=…&page&size`: every entry, newest first (the
bell keeps the latest 50). `/seller/notifications` and `/provider/notifications` show it
(`features/business-inbox`), with an unread filter and "Mark all as read"; the bell's dropdown links
to it ("See all notifications").

## Services online, in bulk (service providers, owner or manager)

`POST /api/catalog/services/online` `{ids, online}` → `{done, failed}`. Each category on the Services
page has "All online" / "Hide all".

## Team

Members without a login (calendar-only staff) can be removed and restored like the others; removed
people are listed on request ("Show removed") and keep their history.

## Saved views (any signed-in person)

| Method & path | Body | Returns |
|---|---|---|
| GET `/api/me/views?list=admin.orders` | | the person's views of that list, by name |
| POST `/api/me/views` | `{list, name (≤ 60), query}` | the view; the same name (any case) replaces it; 20 per list at most (**VALIDATION_FAILED**) |
| DELETE `/api/me/views/{id}` | | only the person's own (**NOT_FOUND** otherwise) |

`query` is the list's URL query without `page`; applying a view just sets the URL, so it carries no
access of its own. Table `saved_view` (`V20261021_170000__saved_views.sql`). `FilterBar` takes a
`views` key and shows the control (View ▾, Save view, Delete view) on: console shops, users,
orders, reviews and audit; seller order history and stock history; customers in both workspaces;
provider appointments and sales.

Filter selects now carry their own `aria-label` (the label text), so their accessible name is no
longer "Label + every option".
