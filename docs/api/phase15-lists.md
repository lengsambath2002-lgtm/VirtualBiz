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
