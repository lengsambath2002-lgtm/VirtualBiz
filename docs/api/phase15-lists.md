# API Phase 15: management lists

Every management list pages, sorts and filters on the server, can be exported as it is filtered,
and (where it makes sense) acts on many rows at once. The same contract and the same components
serve the super-admin console and both shop workspaces.

## The list contract

| Param | Meaning |
|---|---|
| `page` | 0-based page (default 0) |
| `size` | 1–100 rows (default 20) |
| `sort` | one of the list's sort keys; `-key` for descending. Unknown keys are **VALIDATION_FAILED** (keys map to SQL through a fixed table, `PageQuery`) |
| `from`, `to` | Phnom Penh days (`YYYY-MM-DD`), `to` inclusive; either may be left out. `from` after `to`, or a range over the list's limit, is **VALIDATION_FAILED** (`DayRange`) |

Answer: `{items, total, page, size}` (`common.list.PageResponse`). Short lists filtered in memory
use `PageResponse.slice`.

## Console lists (`/api/admin/…`, any staff role)

| List | Filters | Sort keys (default) | Date | Export | Bulk |
|---|---|---|---|---|---|
| `businesses` | `q`, `type`, `verification`, `status` (active/offline/suspended), `category`, `district` | `created`, `name`, `gmv`, `orders`, `rating` (`-created`) | joined | ✓ | `verify`, `reject`*, `suspend`*, `reinstate` |
| `users` | `q`, `kind`, `status` | `created`, `name`, `orders`, `spent` (`-created`) | joined | ✓ | `suspend`*, `reinstate`, `signOut` |
| `orders` | `q`, `status`, `businessId`, `customerId`, `method` (DELIVERY/PICKUP), `pay` (KHQR/CARD/CASH) | `placed`, `total`, `number` (`-placed`) | placed | ✓ | |
| `reviews` | `q`, `stars`, `status`, `businessId`, `replied` (yes/no) | `at`, `stars` (`-at`) | posted | ✓ | `hide`*, `restore` |
| `payouts` | `q` (shop, Bakong ID, reference), `businessId` | `paid`, `amount` (`-paid`) | paid | ✓ | |
| `payouts/balances` | `q`, `due` (payable/held/noBakong) | `payable`, `onHold`, `name` (`-payable`) | | | |
| `payouts/summary` | — | — | — | | totals across all shops: `{payable, onHold, shopsDue}` |
| `promotions` | `q`, `state` | `starts`, `ends`, `uses`, `name` (`-starts`) | | | |
| `audit` | `q`, `targetType`, `targetId`, `action` | newest first | when | ✓ | |

\* needs a `reason` (3–300 characters), checked once before any row.

- **Export**: `GET /api/admin/{list}/export` with the list's own params: every matching row (up to
  50,000) in the list's sort, as `text/csv` (UTF-8 with BOM, CRLF, formula-safe cells; the shared
  `common.csv.CsvWriter`), `Content-Disposition: virtualbiz-{list}-{day}.csv`, `X-Row-Count`. Each
  export is audited: action `DATA_EXPORTED`, target `EXPORT`/`{list}`, details = the filters and the
  row count.
- **Bulk**: `POST /api/admin/{businesses|users|reviews}/bulk` `{ids (≤ 100), action, reason?}` →
  `{done, failed: [{id, code, message}]}`. Each row goes through the single action (same rules,
  audit entry and notification) in its own transaction; a refused row doesn't stop the rest.
- Migration `V20261021_150000__audit_export_target.sql` allows the `EXPORT` audit target.

## Frontend

`src/components/data`: `DataTable` (sortable headers with `aria-sort`, selection with a bulk bar,
skeleton rows, the shared empty and error states), `Pagination` (count, page numbers, rows per
page), `FilterBar` / `SelectFilter` / `SegmentFilter` / `DateRangeFilter` (presets from
`lib/utils/dateRange`, or custom days) with removable chips, `ExportButton`, `ImportDialog` (CSV
file → dry run with per-row problems → import all or only the good rows) and `useListQuery`, which
keeps every filter, the sort, page and size in the URL.

### Date picker

`DateRangePicker` is the one way a date is chosen in the management screens (both workspaces and
the console). A button shows the field and its value ("Placed: Last 30 days", "Placed: 1 Oct – 21
Oct 2026"); it opens a calendar floating above the page (a portal, so dialogs don't clip it):

- **Range** (`mode="range"`, default): presets on the left (Any time, Today, Last 7 / 30 / 90
  days, This / Last month, Last 12 months), two months on the right. The first click picks the
  start, the second the end (picked backwards, they swap); hovering previews the range. Apply
  commits; Cancel, Escape or a click outside leaves the value as it was.
- **Single** (`mode="single"`): one month; a click picks the day and closes. `clearable` adds
  Clear; a Today shortcut is offered.
- `min` / `max` disable days outside the allowed span; `variant="field"` looks like a form input
  (with `id` for a `<label htmlFor>`); `variant="pill"` sits in a filter bar.
- Keyboard: arrows move by day / week, Page Up / Down by month, Enter picks, Escape closes only
  the calendar (not the dialog around it). Phones get a bottom sheet with one month.
- Month and weekday names come from `Intl` in the app's language (km-KH for Khmer); values are
  `YYYY-MM-DD` Phnom Penh days, as the list contract expects. Filter chips use the same wording
  (`formatDays`).

Used by: every list's date filter (`DateRangeFilter`), Settings → Export data's period, shop and
platform promotion start / end (platform codes pair it with a time), provider deals, the
calendar's "Go to date", new appointments and blocked time, shop closure days and the register's
receipts day.

### Every list pages

Every table and list of records pages, **10 rows by default** (`DEFAULT_PAGE_SIZE`; 20, 50 or 100
on request; the API's own default `PageQuery.DEFAULT_SIZE` is 10 too):

- Server-paged lists use `useListQuery` + `Pagination` (console lists, order / sale / appointment
  history, customers, stock history, activity, notifications, category suggestions).
- Lists the screen already holds use `usePagedRows(rows, {resetOn, prefix})` + `Pagination`: the
  seller's open order tabs (they used to stop at 60), products, inventory, promotions and reviews;
  the provider's services (paged in category order), retail products, deals and reviews; the
  customer's orders, bookings and saved items. The page and size are in the URL (`?page=2&size=20`,
  `prefix` for a second list: `?rpage=`); a new search or filter goes back to the first page; a page
  past the end shows the last one.
- The marketplace's grids and reviews (a shop's products and reviews, an item's reviews, the deals
  page) show 12 (reviews 8–10) and **Show more**; Explore loads pages as it scrolls.
- Short previews stay short and link to the full list: the home pages' new orders and booking
  requests (5, then "See all N"), the account sidebar's businesses (5, then "Show all N"), the
  workspace switcher (a search and a scrolling list past 6 shops).
