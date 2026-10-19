# API Phase 5: Seller POS, promotions, reviews, customers

The contract between `backend/vbiz-api` and `frontend` for the last records the workspaces kept
in the browser: the Seller's counter (shifts, cash moves, sales, refunds), the shop's promotions
(and automatic promotions at checkout), customers writing reviews and shops replying, and the
Seller's customer list. It builds on Phases 1–4: same base path, `ApiResponse` envelope,
`StatusCode` names, bearer token and `X-Business-Id` tenancy. After this phase the frontend has no
mock data.

## Conventions

- **Receipt numbers** are `R-` + at least 5 digits (`receipt_number_seq`); the provider's sales
  keep `S-`. Both live in `sale` (Phase 4), now with `shift_id`, `customer_name` and refunds.
- **Stock**: a counter sale takes stock as `POS_SALE`, a refund with "put back" adds `POS_REFUND`,
  both through `inventory.service.StockWriter`. From this phase `POS_SALE` and `POS_REFUND` are
  **server-only**: `POST /api/inventory/movements` answers `VALIDATION_FAILED` (`field: "reason"`).
  Stock never goes below zero (`INSUFFICIENT_STOCK`), so the register cannot oversell.
- **Money** is USD with 2 decimals; riel amounts are whole numbers.

## POS (`com.kosign.vbiz.pos`, merchant, `PRODUCT` business, any member)

```text
Shift   = {id, openedAt, openedBy, openedByName, floatUsd, floatKhr,
           moves: [{amount (signed), note, at, byName}],
           cashSales, cashRefunds, expectedUsd,
           closedAt?, closedByName?, countedUsd?, difference?}
PosSale = {id, clientRef?, number, shiftId?, lines: [{productId, variantId, title, variantName, qty, unitPrice}],
           subtotal, discount, discountReason?, total, payments: [{method, amount}],
           cash?: {usd, khr, change}, customerName?, byName,
           refunds: [{at, amount, method, restock, lines: [{variantId, qty}], byName}], at}
```

`expectedUsd = floatUsd + floatKhr ÷ 4100 + cashSales − cashRefunds + Σ moves` (cash payments in USD).

| Method & path | Body | Returns |
|---|---|---|
| GET `/api/pos/shift` | | the open `Shift`, or `null` |
| POST `/api/pos/shift` | `{floatUsd, floatKhr}` | **201** `Shift`; `SHIFT_ALREADY_OPEN` |
| POST `/api/pos/shift/moves` | `{amount, note}` (amount signed, ≠ 0) | `Shift`; taking out more than `expectedUsd` is `VALIDATION_FAILED` (`amount`) |
| POST `/api/pos/shift/close` | `{countedUsd}` | the closed `Shift` (`difference = countedUsd − expectedUsd`) |
| GET `/api/pos/shifts` | `limit` (≤ 100, default 30) | closed shifts, newest first |
| GET `/api/pos/sales` | `from`, `to` (dates, default the last 31 days) | `PosSale[]` newest first |
| POST `/api/pos/sales` | `{clientRef, lines: [{variantId, qty, unitPrice}], discount, discountReason?, customerName?, payments, cash?, at?}` | **201** `PosSale` (200 with the stored sale when `clientRef` was already used) |
| POST `/api/pos/sales/{ref}/refunds` | `{lines: [{variantId, qty}], amount, method, restock}` | `PosSale` |

Sale rules: `clientRef` is a UUID the register makes, so a sale queued offline and sent again is
stored once. 1–100 lines, `qty` 1–999, `unitPrice` ≥ 0; `discount` between 0 and the subtotal; the
payments add up to `total = subtotal − discount` (`VALIDATION_FAILED`, `payments`). The sale
belongs to the open shift, or (a sale queued offline) to the shift that was open at `at`;
otherwise `SHIFT_NOT_FOUND`. `at` (when it was rung up) may be up to 7 days in the past and
defaults to now.

Refund rules: each variant's quantity at most what was sold minus what was refunded; `amount`
between 0.01 and the total minus earlier refunds (`VALIDATION_FAILED`). A cash refund counts
against the open shift's drawer.

## Promotions (`com.kosign.vbiz.promotion`, merchant; writes need an owner or manager)

```text
Promotion = {id, name, type: PERCENT|FIXED|FREE_SHIPPING, value, code?, scope: ALL|CATEGORY|PRODUCTS,
             targetIds[], minSpend?, maxDiscount?, startsAt, endsAt, uses, usageLimit?,
             state: ACTIVE|SCHEDULED|USED_UP|ENDED}
```

| Method & path | Body | Returns |
|---|---|---|
| GET `/api/promotions` | | the shop's promotions, newest start first |
| POST `/api/promotions` | all fields but `id`, `uses`, `state` | **201** `Promotion` |
| PATCH `/api/promotions/{id}` | any of them | `Promotion` |
| POST `/api/promotions/{id}/end` | | `{promotion, previousEndsAt}` — ends it yesterday (the prototype's "End now"); Undo is a `PATCH` of `endsAt` |

Rules: `name` 2–60; `PERCENT` 1–90, `FIXED` > 0, `FREE_SHIPPING` value 0; `code` 3–20 of
`A–Z 0–9`, upper-cased, unique among the shop's codes and the platform's (`VALIDATION_FAILED`,
`code`); `endsAt` after `startsAt`. `targetIds`: collection ids (`CATEGORY`) or product ids
(`PRODUCTS`) of the shop.

**At checkout** a shop's automatic promotions (no `code`) apply to that shop's lines without the
customer doing anything: the best one (largest discount; free delivery counts as the fee it
waives) is added to the order's `promoDiscount`, next to a promo code. Placing the order counts a
use. Quotes show it per shop as `autoPromo: {id, name, amount, freeShipping}`.

## Reviews (`com.kosign.vbiz.review`)

```text
MyReview = {id, orderNumber?, bookingNumber?, itemSlug, itemType: PRODUCT|SERVICE,
            stars, tags[], text, reply?, at}
```

| Method & path | Auth | Body | Returns |
|---|---|---|---|
| POST `/api/me/reviews` | signed in | `{order? \| booking?, item (slug), stars, tags[], text}` | **201** `MyReview` |
| GET `/api/me/reviews` | signed in | | the customer's reviews, newest first |
| GET `/api/reviews` | merchant | | the shop's reviews (Phase 4) |
| POST `/api/reviews/{id}/reply` | merchant (owner / manager) | `{text}` | the review (Phase 4) |

Rules: an order must be the customer's, `DELIVERED` or `PICKED_UP`, and contain the product; a
booking must be the customer's, `COMPLETED`, for that service (`VALIDATION_FAILED`, `order` /
`booking` / `item`). One review per item per order or booking (`CONFLICT`). `stars` 1–5, up to 5
tags of 30 characters, `text` up to 1000. The review is `verified`, carries the customer's name,
updates the item's and the shop's rating and count, marks the order `reviewed`, and sends the
shop `NEW_REVIEW` (`name`, `stars`).

## Customers (Seller CRM)

`GET /api/clients` (Phase 4) now answers for product shops too. A product shop's clients are the
accounts that ordered from it: placing an order finds or creates the client (by account, then
phone) with the delivery district; existing orders were back-filled by the migration. `Client`
gains `district?`. Order count, spend and last order stay derived on the client from the orders.

## New status codes

| Code | HTTP | When |
|---|---|---|
| `SHIFT_ALREADY_OPEN` | 409 | Opening a shift while one is open |

`SHIFT_NOT_FOUND`, `SALE_NOT_FOUND`, `PROMOTION_NOT_FOUND`, `REVIEW_NOT_FOUND` and `CONFLICT`
already exist.
