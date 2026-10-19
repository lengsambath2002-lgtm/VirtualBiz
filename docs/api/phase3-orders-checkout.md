# API Phase 3: cart, checkout, orders, payments, delivery fees, notifications, live updates

The contract between `backend/vbiz-api` and `frontend` for the customer's cart and checkout, the
orders it creates (customer tracking and the seller's order flow), payments (KHQR, card, cash on
delivery), delivery fees, promo codes at checkout, the minimal in-app inbox and the live update
stream. It builds on [Phase 1](./phase1-auth-account-business.md) and
[Phase 2](./phase2-catalog-inventory.md): same base path, `ApiResponse` envelope, `StatusCode`
names, bearer token and `X-Business-Id` tenancy.

Out of scope (later phases): POS sales (Phase 5 moves them server-side; until then the POS keeps
posting `POS_SALE` / `POS_REFUND` to `POST /api/inventory/movements`), bookings (Phase 4), writing
reviews (Phase 5; the "Rate" button keeps its local behaviour), seller promotions CRUD, the CRM.

## Conventions

- **Money** is a JSON number, USD, 2 decimals (`NUMERIC(12,2)`). Every total the customer sees
  comes from the server (`POST /api/checkout/quote`); the client never adds prices itself.
- **Order numbers** are `VB-` + at least 5 digits from one Postgres sequence (`order_number_seq`),
  continuing after the seeded orders. URLs use the number (`/orders/VB-24039`); every
  `{ref}` path segment below accepts the number or the id.
- **Times** are ISO-8601 UTC instants. The delivery window is a Phnom Penh time-of-day range.
- **Stock**: placing an order takes the stock (`ORDER_SALE`, one movement per line, note = the
  order number, "System"); a cancellation, rejection, auto-cancel or expired payment puts it back
  (`ORDER_CANCELLED`); a return with "put back on the shelf" adds `CUSTOMER_RETURN`. All of them go
  through `inventory.service.StockWriter`. `ORDER_SALE` and `ORDER_CANCELLED` are **server-only**
  from this phase: `POST /api/inventory/movements` answers `VALIDATION_FAILED` (`field: "reason"`).

## Cart (`com.kosign.vbiz.cart`, signed in)

A guest keeps the cart in the browser. On sign-in the browser merges it into the server cart
(`POST /merge`) and from then on mirrors every change with `PUT`.

| Method & path | Body | Returns |
|---|---|---|
| GET `/api/me/cart` | | `Cart` |
| PUT `/api/me/cart` | `CartInput` | `Cart` — replaces both lists (the order of the lines is kept) |
| POST `/api/me/cart/merge` | `CartInput` | `Cart` — adds the guest lines: same variant → quantities add up (capped at the stock, at least 1), merged lines come back selected; `later` lines are added when not already saved |

```text
CartInput = {lines: [{variantId, qty, selected?}], later?: [{variantId, qty}]}
Cart      = {lines: CartLine[], later: CartLine[]}
CartLine  = {variantId, productId, productSlug, shopSlug, options: {name: value}, qty, selected}
```

Rules: at most 100 lines per list, `qty` 1–999 (`VALIDATION_FAILED`). A variant that does not exist,
was deleted or whose product is not listed (`DRAFT`, deleted, shop offline) is dropped silently
(also from `GET`), so a stale browser cart never blocks the sync. The same variant twice in one
list is merged. Stock is not checked here (the quote and checkout do).

## Checkout (`com.kosign.vbiz.order`, `delivery`, `promotion`)

| Method & path | Auth | Body | Returns |
|---|---|---|---|
| POST `/api/checkout/quote` | public (an `addressId` needs a token) | `CheckoutInput` | `Quote` |
| POST `/api/checkout` | signed in | `CheckoutInput` + header `Idempotency-Key` | **201** `CheckoutResult` |

```text
CheckoutInput = {lines: [{variantId, qty}],              // the selected cart lines, 1–100
                 method?: DELIVERY|PICKUP,                // default DELIVERY
                 addressId?,                              // DELIVERY at checkout needs it
                 district?,                               // quote without an address (the cart page's area)
                 window?: "HH:MM–HH:MM" | null,           // null = ASAP
                 note?: string (≤ 120),                   // rider / shop note
                 promoCode?: string,
                 paymentMethod?: KHQR|CARD|CASH}          // required by POST /api/checkout
Quote         = {method, district?, count, subtotal, discount, promoDiscount, deliveryFee, total,
                 shops: QuoteShop[], promo?: QuotePromo, problems: QuoteProblem[]}
QuoteShop     = {businessId, shopSlug, shopName, lines: QuoteLine[], subtotal, discount, promoDiscount,
                 deliveryFee, deliveryWaived, freeDeliveryOver?, toFreeDelivery, total, pickup, cod}
QuoteLine     = {variantId, productId, productSlug, title, variantName, options{}, qty,
                 listPrice, unitPrice, lineTotal, stock}
QuotePromo    = {code, name, type, value, minSpend?, maxDiscount?, businessId?, applied,
                 reason?: UNKNOWN|SCHEDULED|ENDED|USED_UP|MIN_SPEND|NOT_APPLICABLE, shortBy?}
QuoteProblem  = {field: "lines[i]", code: INSUFFICIENT_STOCK|VARIANT_NOT_FOUND, variantId, stock?}
CheckoutResult = {checkoutId, orders: Order[], payment: PaymentIntent | null}   // null for CASH
```

Pricing (mirrors `frontend/src/lib/pricing`):

1. **Lines.** `listPrice` = the variant's `compareAt` when it is above the price, else the price;
   `unitPrice` = the variant's price (what the customer pays). `subtotal` = Σ listPrice × qty,
   `discount` = Σ (listPrice − unitPrice) × qty (shop discounts).
2. **One order per shop**, in the order the shops first appear in `lines`.
3. **Delivery fee** per shop (`delivery.DeliveryFees`): pickup is free; delivery is free when the
   shop's item total (after shop discounts, before the promo) is at least the shop's
   `freeDeliveryOver`; otherwise the zone fee of the customer's district (a district in no zone
   falls into the last zone; no zones = free). `toFreeDelivery` = what is missing to the
   threshold (0 when free or when the shop has none). The district is the address's, else
   `district`, else none (fee of the last zone).
4. **Promo code** (case-insensitive): a platform code (`business_id` null) applies to the whole
   checkout; a shop's own code applies to that shop's lines only. Scope `ALL`, `CATEGORY`
   (`targetIds` = category ids) or `PRODUCTS` (`targetIds` = product ids or slugs) picks the
   eligible lines; `minSpend` is checked against their total. `PERCENT` (capped at
   `maxDiscount`), `FIXED` (never more than the eligible total) or `FREE_SHIPPING` (delivery fees
   of the shops concerned become 0, `deliveryWaived: true`). The discount is split across shops
   in proportion to their eligible totals, to the cent, the remainder on the last shop, so the
   orders always add up to the quote. Window `[startsAt, endsAt)` and `usageLimit` are checked;
   each placed checkout counts one use.
5. `total` = subtotal − discount − promoDiscount + deliveryFee (per shop and overall).

The quote never fails for a pricing reason: an unknown code comes back as `promo.applied=false,
reason=UNKNOWN`; a code below its minimum as `MIN_SPEND` with `shortBy`; missing stock as a
`problems` entry. Lines whose variant is gone are left out of `shops` and reported in `problems`.

**Placing** (`POST /api/checkout`) re-prices exactly like the quote, then refuses with:

| Code | When |
|---|---|
| `VALIDATION_FAILED` | `paymentMethod` missing; DELIVERY without `addressId` (`field: "addressId"`); bad `window` (format, not today between 09:00 and 22:00, or less than 2 h ahead); note > 120 |
| `ADDRESS_NOT_FOUND` | not one of the customer's addresses |
| `VARIANT_NOT_FOUND` | a line's variant is gone or no longer listed (`field: "lines[i]"`) |
| `INSUFFICIENT_STOCK` | one detail **per short line**: `field: "lines[i]"`, `meta: {variantId, stock, requested}` |
| `PROMO_INVALID` | the code does not apply: `meta.reason` as in the quote (and `shortBy`) |
| `SHOP_UNAVAILABLE` | a shop went offline (`meta.businessId`) |
| `FULFILMENT_UNAVAILABLE` | PICKUP at a shop with pickup off (`meta.businessId`) |
| `PAYMENT_METHOD_UNAVAILABLE` | CASH on delivery at a shop with COD off (`meta.businessId`) |
| `IDEMPOTENCY_CONFLICT` | the `Idempotency-Key` was used for a different request |

Everything happens in one transaction: the stock of every line is locked (in variant-id order)
and taken through `StockWriter.writeAll`, the orders, lines, payments and the timeline are
written, the promo use is counted, and the placed lines leave the server cart. The same
`Idempotency-Key` (8–64 characters, per customer) returns the stored `CheckoutResult` again
without placing anything twice.

## Payments (`com.kosign.vbiz.payment`)

`PaymentMethod` × `PaymentChannel` (open question #8): `KHQR` and `CARD` are `ONLINE`; `CASH` is
`COD` (paid to the rider on delivery, or at the counter on pickup). Each order has one `payment`
row; KHQR and CARD checkouts also have one `PaymentIntent` that covers all their orders (one QR
for the whole checkout). VirtualBiz collects online payments and pays each shop out to its Bakong
ID (the payment row keeps `payoutTo` and the 5% `commission` on `ONLINE` payments).

```text
PaymentIntent = {id, method: KHQR|CARD, status: PENDING|PAID|EXPIRED|CANCELLED|FAILED, amount,
                 currency: "USD", khqr?: string, md5?: string, expiresAt?, paidAt?, orderNumbers[]}
OrderPayment  = {method, channel, status: PENDING|PAID|REFUNDED|CANCELLED|EXPIRED, paid, amount, paidAt?}
```

| Method & path | Auth | Returns |
|---|---|---|
| GET `/api/me/payments/{id}` | owner | `PaymentIntent` (asks the gateway first while `PENDING`) |
| POST `/api/me/payments/{id}/cancel` | owner | `PaymentIntent` — `CANCELLED`; its orders are cancelled (`paymentCancelled`) and restocked |
| POST `/api/me/payments/{id}/simulate` | owner, **local simulator only** | `PaymentIntent` — `PAID` as if the bank had confirmed the transfer |

- **KHQR**: the intent carries a real EMVCo / Bakong KHQR string (`payment.khqr.KhqrBuilder`:
  tags 00/01/29/52/53/54/58/59/60/62/99, CRC-16/CCITT in tag 63) for the configured VirtualBiz
  merchant account (`vbiz.payment.khqr.*`), the amount in USD, the first order number as bill
  number, and its MD5 (what Bakong's "check transaction by MD5" takes). It expires after
  `vbiz.payment.khqr.ttl` (3 min, the prototype's countdown). While pending, its orders exist
  (stock taken) but the seller does not see them and the 1-hour clock has not started. On
  `PAID` the orders are **placed**: `placedAt` is set, the seller is notified (or the order is
  accepted at once when the shop has auto-accept on). An unpaid intent past `expiresAt` is
  expired by the scheduler: orders `CANCELLED` (`paymentExpired`), stock back.
- **Settlement** is behind `payment.gateway.KhqrGateway` (`status(md5)`): the Bakong
  implementation needs the merchant's Bakong API token and is not built; the local
  `LocalKhqrGateway` never confirms by itself — `POST …/simulate` (enabled by
  `vbiz.payment.simulator.enabled`, on in local / dev / test only; `NOT_FOUND` elsewhere) is the
  "bank confirmed" path the prototype's **Simulate payment** button uses.
- **CARD** goes through `payment.gateway.CardGateway`; the local stub approves at once
  (`gatewayRef: "SIM-…"`), so card orders are placed and paid in the checkout call. A declined
  card would answer `PAYMENT_FAILED` and nothing is placed.
- **CASH**: the order is placed at once; its payment stays `PENDING` until the order is
  `DELIVERED` / `PICKED_UP`, then `PAID`.
- **Refunds**: cancelling, rejecting or returning a paid online order sets its payment
  `REFUNDED` (the gateway's `refund` is a no-op in the simulator); an unpaid COD payment becomes
  `CANCELLED`.

Errors: `PAYMENT_NOT_FOUND` (unknown or someone else's), `INVALID_STATUS_TRANSITION` (not
`PENDING`), `PAYMENT_EXPIRED` (simulate after `expiresAt`).

## Orders

### Shape

```text
Order = {id, number, checkoutId, businessId, shop: {id, slug, name, phone, street, district},
         customer: {id, name, phone?, email?}, status, method: DELIVERY|PICKUP,
         lines: [{variantId, productId, productSlug, title, variantName, options{}, sku, qty, listPrice, unitPrice}],
         subtotal, discount, promoDiscount, promoCode?, deliveryFee, total,
         payment: OrderPayment, paymentIntentId?,
         address?: {label, name, phone, line, district, note?, lat?, lng?},
         window?: "14:00–15:00", scheduledFor?, note?,
         deliveryBy?: VIRTUALBIZ_RIDER|OWN_DELIVERY, rider?: {name, vehicle, plate},
         timeline: [{status, at, note?}],
         createdAt, placedAt?, acceptedAt?, packedAt?, shippedAt?, fulfilledAt?, cancelledAt?, returnedAt?,
         cancelReason?, cancelDeadline?, canCancel, autoCancelAt?, reviewed}
```

`cancelReason` is a code the UI translates: `customer.<mistake|change|slow|other>`,
`rejected.<outOfStock|cantDeliver|listingError|closingEarly>`, `auto` (not accepted in time),
`paymentExpired`, `paymentCancelled`, `returned.<damaged|wrongItem|changedMind>` (on `RETURNED`).
A failed delivery adds a timeline entry `{status: PACKED, note: "failed.<noAnswer|wrongAddress|refused>"}`.

### Customer (`/api/me/orders`, signed in)

| Method & path | Body / query | Returns |
|---|---|---|
| GET `/api/me/orders` | `bucket=active\|done\|cancelled`, `q` (number or item title) | `Order[]`, newest first (KHQR orders still awaiting payment are left out) |
| GET `/api/me/orders/{ref}` | | `Order`. `ORDER_NOT_FOUND` for someone else's |
| POST `/api/me/orders/{ref}/cancel` | `{reason: mistake\|change\|slow\|other}` | `Order` — only while `NEW` and within 5 minutes of `placedAt` (`CANCEL_WINDOW_PASSED`) |

Buckets: `active` = NEW…SHIPPED, `done` = DELIVERED / PICKED_UP / RETURNED, `cancelled` = CANCELLED.

### Seller (`/api/orders`, merchant: bearer + `X-Business-Id`, any member)

| Method & path | Body | Transition |
|---|---|---|
| GET `/api/orders` | `tab=new\|pack\|ship\|done\|cancelled`, `q`, `limit` (≤ 500) | `Order[]` newest first; placed orders only |
| GET `/api/orders/counts` | | `{new, pack, ship, out, todaySales, todayOrders}` (home to-dos and rail badge) |
| GET `/api/orders/{ref}` | | `Order` |
| POST `/api/orders/accept` | `{ids: [...]}` | NEW → ACCEPTED for each (others skipped); `{orders, skipped}` |
| POST `/api/orders/accept/undo` | `{ids}` | ACCEPTED → NEW when accepted ≤ 30 s ago (`UNDO_WINDOW_PASSED`) |
| POST `/api/orders/{ref}/reject` | `{reason, markSoldOut?}` | NEW → CANCELLED (`rejected.<reason>`), restock; `markSoldOut` then zeroes those variants (`MARKED_SOLD_OUT`) |
| POST `/api/orders/{ref}/pack` | | ACCEPTED → PACKED |
| POST `/api/orders/{ref}/ship` | `{deliveryBy: VIRTUALBIZ_RIDER\|OWN_DELIVERY}` | PACKED → SHIPPED (delivery orders); a VirtualBiz rider is assigned |
| POST `/api/orders/{ref}/pickup` | | PACKED → PICKED_UP (pickup orders); COD becomes paid |
| POST `/api/orders/{ref}/deliver` | | SHIPPED → DELIVERED; COD becomes paid |
| POST `/api/orders/{ref}/fail` | `{reason: noAnswer\|wrongAddress\|refused}` | SHIPPED → PACKED (rider cleared) |
| POST `/api/orders/{ref}/return` | `{reason: damaged\|wrongItem\|changedMind, restock}` | DELIVERED / PICKED_UP → RETURNED within 7 days (`RETURN_WINDOW_PASSED`); refund; `restock` adds `CUSTOMER_RETURN` |
| POST `/api/orders/bulk` | `{action: PACK\|SHIP, ids}` | PACK: ACCEPTED → PACKED; SHIP: PACKED → SHIPPED (VirtualBiz rider) or PICKED_UP; `{orders, skipped}` |

Every transition is checked by `OrderStatus.transitionTo(target, method)` and answers
`INVALID_STATUS_TRANSITION` otherwise. Reject reasons, fail reasons and return reasons outside the
lists are `VALIDATION_FAILED`.

### Auto-cancel (`order.scheduler.OrderJobs`)

Every `vbiz.orders.jobs.interval` (1 min) the job cancels placed `NEW` orders older than
`vbiz.orders.auto-cancel-after` (1 h, `OrderStatus.AUTO_CANCEL_AFTER`): reason `auto`, stock back
(`ORDER_CANCELLED`, System), payment refunded / cancelled, the customer and the shop are notified
and both streams get the update. The same job expires KHQR intents past their `expiresAt`. Local
and test profiles expose `POST /api/dev/orders/{ref}/age` (`{minutes}` — moves the order's
`placedAt` back) and `POST /api/dev/jobs/orders` (runs the job now) for end-to-end tests
(`vbiz.dev.endpoints-enabled`; `NOT_FOUND` elsewhere).

## Notifications (`com.kosign.vbiz.notification`, minimal; Phase 5 extends it)

```text
Notification = {id, kind, params: {string: string}, route, unread, at}
```

| Method & path | Returns |
|---|---|
| GET `/api/me/notifications` | the customer's inbox, newest first (≤ 50) |
| POST `/api/me/notifications/{id}/read` | `Notification` |
| POST `/api/me/notifications/read-all` | empty |
| GET `/api/notifications` (merchant) | the shop's inbox (shared by its members), newest first (≤ 50) |
| POST `/api/notifications/{id}/read` (merchant) | `Notification` |
| POST `/api/notifications/read-all` (merchant) | empty |

Kinds (the client translates `kind` with `params`): customer — `ORDER_ACCEPTED`,
`ORDER_READY_PICKUP`, `ORDER_ON_THE_WAY`, `ORDER_DELIVERED`, `ORDER_PICKED_UP`,
`ORDER_CANCELLED` (`reason`), `ORDER_RETURNED`; shop — `NEW_ORDER` (`number`, `name`, `amount`),
`ORDER_CANCELLED` (`number`, `reason`), `LOW_STOCK` (`item`, `n`), `NEW_REVIEW` (`name`, `stars`).
Routes: `/orders/VB-…` (customer), `/seller/orders?order=<id>` (shop).

## Live updates (`com.kosign.vbiz.notification.sse`)

`EventSource` cannot send headers, and an access token must never sit in a URL (logs, history).
The client therefore trades its bearer token for a **stream ticket**:

| Method & path | Auth | Returns |
|---|---|---|
| POST `/api/stream/ticket` | bearer (+ `X-Business-Id` for the shop stream) | `{ticket, expiresIn: 60}` — random, single use, 60 s, bound to the user (and business) |
| GET `/api/stream/me?ticket=` | ticket | `text/event-stream` of the customer's events |
| GET `/api/stream/business?ticket=` | ticket issued with `X-Business-Id` | `text/event-stream` of the shop's events |

A missing, used, expired or wrong-scope ticket answers `STREAM_TICKET_INVALID` (401). Events
(sent after the transaction commits): `order` `{id, number, businessId, status, paymentStatus}`,
`payment` `{id, status}`, `notification` `{id, kind}`, plus a comment ping every 25 s. The stream
closes after 30 minutes; the client gets a new ticket and reconnects (also after errors, with
back-off). The hub is in memory (one API instance); a multi-instance deployment needs a shared
bus (Postgres `LISTEN/NOTIFY` or Redis) behind the same `StreamHub` interface.

## New status codes

| Code | HTTP | When |
|---|---|---|
| `PROMO_INVALID` | 422 | The promo code does not apply (`meta.reason`, `meta.shortBy`) |
| `SHOP_UNAVAILABLE` | 409 | A shop in the checkout is offline (`meta.businessId`) |
| `FULFILMENT_UNAVAILABLE` | 409 | Pickup is off at that shop |
| `PAYMENT_METHOD_UNAVAILABLE` | 409 | Cash on delivery is off at that shop |
| `IDEMPOTENCY_CONFLICT` | 409 | `Idempotency-Key` reused for another request |
| `CANCEL_WINDOW_PASSED` | 409 | Customer cancel after 5 minutes or after the shop accepted |
| `RETURN_WINDOW_PASSED` | 409 | Return more than 7 days after delivery |
| `UNDO_WINDOW_PASSED` | 409 | Undo accept more than 30 s later |
| `PAYMENT_NOT_FOUND` | 404 | Unknown payment intent (or another customer's) |
| `PAYMENT_EXPIRED` | 409 | The KHQR expired before it was paid |
| `PAYMENT_FAILED` | 402 | The card gateway declined |
| `STREAM_TICKET_INVALID` | 401 | Bad stream ticket |

## Implementation notes (backend, as built)

- **Tables** (`V20261015_120000__cart_orders_payments.sql`): `cart_line`, `checkout`
  (idempotency key per customer, the stored result), `orders`, `order_line`, `order_event`
  (timeline), `payment_intent`, `payment`, `notification`, sequence `order_number_seq`.
  Indexes: orders by `(business_id, status, placed_at)`, `(customer_id, created_at)`, partial
  `(placed_at) WHERE status = 'NEW'` for the auto-cancel scan; intents by `(status, expires_at)`;
  notifications by `(user_id, at)` and `(business_id, at)`.
- **Stock** for a checkout is one `StockWriter.writeAll` call: variants locked `FOR UPDATE` in id
  order (no deadlock between two checkouts), every line checked before any is written, one
  `INSUFFICIENT_STOCK` with a detail per short line. `ArchitectureTest` also checks that only
  the inventory package touches `StockWriter`'s internals and nothing else calls `adjustStock`.
- **Concurrency**: status changes lock the order row (`PESSIMISTIC_WRITE`); the auto-cancel job
  and a seller's accept cannot both win.
- **Seed (local + test, `V20261015_120100__seed_local_orders.sql`)**: the prototype's order
  history for Nita Gadget Store (today's 7 orders VB-01041…VB-01047 and the 30-day history
  below them) from the seller mock, placed by the ten mock customers (now accounts
  `…@gmail.com`-style, password `Demo@1234`), and Kry Sonita's delivered SK Fashion order
  VB-24038; the sequence continues at VB-24039. Each sold line has its `ORDER_SALE` (and
  `ORDER_CANCELLED` for cancelled ones) movement, with one `RECEIVED` "Stock before order
  history" movement per variant so every variant keeps its seeded stock and stock = Σ movements.
  The shop inbox gets the new-order, low-stock and review notifications from the mock.
