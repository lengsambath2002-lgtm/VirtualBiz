# API Phase 11: shop settings and policy

Everything a shop owner needs to run their shop their way, from the workspace's Settings, with no
values fixed in code.

## Shop policy (both business types)

`PATCH /api/businesses/{id}` takes `policy`, merged field by field into `business.policy` (JSONB).
`GET` returns it complete (defaults filled in).

| Field | Rule | Used by |
|---|---|---|
| `receiptHeader` / `receiptFooter` | up to 120 / 300 characters | POS and service checkout receipts (the footer replaces the default warranty line) |
| `taxPct` | 0–20, 2 decimals (default 0) | receipts show the VAT inside the total; prices are VAT-inclusive, totals unchanged |
| `taxId` | 4–20 letters, digits, `-` | receipts ("VAT TIN …") |
| `payCash` / `payKhqr` / `payCard` | at least one true (default all) | the register and service checkout show only these; `POST /api/pos/sales` and `POST /api/sales` refuse others (`VALIDATION_FAILED` on `payments[i].method`) |
| `facebook` `telegram` `instagram` `tiktok` `website` | up to 200 characters | the shop's links |

## Product shops (`productSettings`)

- `returnDays` (0–30, default 7): a delivered or picked-up order can be returned this long after
  fulfilment (`RETURN_WINDOW_PASSED` after).
- `zones`: edited in full (add, rename, districts, fee; a district belongs to one zone).
- `lowStockDefault` any whole number; `prepMinutes` 0–1440.

## Service providers (`bookingSettings`)

- `slotMinutes` (5, 10, 15, 20, 30, 45 or 60; default 30): online start times step by this.
- `maxDaysAhead` (1–180, default 90): days past it are closed to online booking (`SLOT_UNAVAILABLE`
  reason `far`). Staff can still book any date from the calendar.
- `tipPresets` (up to 5, each 0–50 %; default 0, 5, 10, 15): the checkout's tip choices.
- `reminderHours` (0 = off), `minNoticeHours`, `freeCancelHours`, `bufferMinutes`: free choices.

## Location, hours and closures (both)

District, street, contact email and map pin (`lat` / `lng`, "use my location"), opening hours to
the quarter hour, and dated closures. The provider calendar spans the shop's opening hours and
staff shifts instead of a fixed 07:00–21:00; staff shifts are set to the quarter hour too.

## Who may change what

See docs/api/phase10-shop-team.md: owner and managers change settings (staff read only); only the
owner changes the payout account.

## Database

Flyway `V20261020_160000__shop_policy.sql`: `business.policy` (JSONB, null = defaults). The new
product and booking settings fields live in the existing JSONB columns (null = default).
