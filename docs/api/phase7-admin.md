# API Phase 7: the super-admin console

The contract for VirtualBiz's own staff: a console at `/admin` to run the marketplace the way
real platforms do: check shop owners' IDs, suspend shops and accounts, settle order disputes,
moderate reviews, run platform promo codes, pay shops out and keep an audit trail. It builds on
Phases 1–6: same base path, `ApiResponse` envelope, `StatusCode` names and bearer token. Admin
endpoints never take `X-Business-Id`.

## Staff and access

- `users.platform_role`: `null` (everyone else), `ADMIN` or `SUPER_ADMIN`. `User` and `Me` carry
  `platformRole` (omitted when null); the profile switcher and the account menu show
  "Admin console" to staff.
- Every `/api/admin/**` call needs a signed-in, non-suspended staff account, otherwise **403**
  `ADMIN_ONLY` (**401** `UNAUTHORIZED` when signed out).
- Only a `SUPER_ADMIN` grants or removes roles and changes another staff account (suspend,
  sign out): **403** `SUPER_ADMIN_ONLY`. Nobody changes their own account here (**403**
  `FORBIDDEN`).
- There is no sign-up for staff. A super-admin gives the role to an existing account; the first
  one is set in the database (`docs/ops/deploy.md`).

## Sessions and suspension

- The JWT filter now asks `SessionValidator` on every request: the token's session must not be
  revoked and its account not suspended. A revoked session (sign out everywhere, password reset,
  suspension) stops working at once instead of when its access token expires.
- A suspended account cannot sign in by any method (**403** `ACCOUNT_SUSPENDED`, after its
  credentials were checked) and its refresh token is refused.
- A suspended business (`business.suspended_at`) is left out of the marketplace (lists, search,
  its own page answers `BUSINESS_NOT_FOUND`), and checkout and online booking refuse it
  (`SHOP_UNAVAILABLE` / not bookable). Its workspace keeps working (in-store sales, open orders),
  with a banner giving the reason.

`Business` gains `verificationNote` (the rejection reason), `suspendedAt` and `suspendedReason`.

## Endpoints

Lists take `page` (0-based) and `size` (1–100, default 20) and answer
`{items, total, page, size}`. Actions that affect someone take `{reason}` (3–300 characters,
**422** `VALIDATION_FAILED` otherwise); it is shown to them and kept in the audit log.

| Method & path | Body | Returns |
|---|---|---|
| GET `/api/admin/overview` | | `Overview`: GMV / orders / commission / bookings / new users / new shops for today, 7 and 30 days and the 30 before; counts; queues (pending ID checks, stuck orders, payouts due, suspended shops and accounts, 1–2★ reviews this week); 30 days of GMV; top 5 shops |
| GET `/api/admin/businesses` | `?q&type&verification&status=active\|offline\|suspended&sort=newest\|pending\|gmv\|rating\|name` | page of `AdminBusinessRow` |
| GET `/api/admin/businesses/{id}` | | `AdminBusinessDetail` (stats, payable, members, recent orders, history) |
| GET `/api/admin/businesses/{id}/id-photo` | | `{contentType, size, dataUrl, uploadedAt}`; **404** when none |
| POST `/api/admin/businesses/{id}/verify` | `{reason?}` | detail; from PENDING or REJECTED |
| POST `/api/admin/businesses/{id}/reject` | `{reason}` | detail; also revokes a verification |
| POST `/api/admin/businesses/{id}/suspend` | `{reason}` | detail; **409** `CONFLICT` when already suspended |
| POST `/api/admin/businesses/{id}/reinstate` | `{reason?}` | detail |
| GET `/api/admin/users` | `?q&kind=customer\|merchant\|staff&status=active\|suspended` | page of `AdminUserRow` |
| GET `/api/admin/users/{id}` | | `AdminUserDetail` (sign-in methods, last seen, active sessions, businesses, recent orders, history) |
| POST `/api/admin/users/{id}/suspend` | `{reason}` | detail; revokes every session |
| POST `/api/admin/users/{id}/reinstate` | `{reason?}` | detail |
| POST `/api/admin/users/{id}/sign-out` | `{reason?}` | detail; revokes every session without suspending |
| PUT `/api/admin/users/{id}/role` | `{role: null \| "ADMIN" \| "SUPER_ADMIN"}` | detail (super-admin only) |
| GET `/api/admin/orders` | `?q&status=<status>\|open\|unpaid&businessId&customerId` | page of `AdminOrderRow` |
| GET `/api/admin/orders/{number}` | | `AdminOrderDetail` (lines, address, timeline, payment, history) |
| POST `/api/admin/orders/{number}/cancel` | `{reason}` | detail; NEW, ACCEPTED or PACKED only |
| POST `/api/admin/orders/{number}/refund` | `{reason, restock}` | detail; DELIVERED or PICKED_UP, no return window |
| GET `/api/admin/reviews` | `?q&stars&status=visible\|hidden\|low&businessId` | page of `AdminReviewRow` |
| POST `/api/admin/reviews/{id}/hide` | `{reason}` | the row |
| POST `/api/admin/reviews/{id}/restore` | `{reason?}` | the row |
| GET / POST `/api/admin/promotions` | `PromotionInput` (code required) | platform `Promotion`s |
| PATCH `/api/admin/promotions/{id}` | `PromotionInput` | the promotion |
| POST `/api/admin/promotions/{id}/end` | | the promotion, ended now |
| GET `/api/admin/payouts/balances` | | `PayoutBalance[]` (shops with money payable or on hold) |
| GET `/api/admin/payouts` | `?businessId` | page of `Payout` |
| POST `/api/admin/payouts` | `{businessId, reference, note?}` | **201** `Payout` |
| GET `/api/admin/audit` | `?q&targetType&targetId&action` | page of `AuditEntry` |
| GET `/api/payouts` | (shop, `X-Business-Id`, owner or manager) | `{balance, payouts (last 10), releaseDays, commissionPct}` |

### Orders: support's dispute tools

- **Cancel** (before it ships): the order becomes CANCELLED with reason `admin.cancel`, the stock
  goes back through the stock writer, a paid payment is refunded, and both sides are told. The
  admin's words are the note on the order's timeline event.
- **Refund** (after delivery or pickup, any time): RETURNED with reason `admin.refund`, payment
  refunded, stock back when `restock`.

### Reviews

A hidden review (`review.hidden_at`) leaves the shop's and the item's public lists and the
shop's own list, and stops counting in the item's and shop's rating and review count
(`ReviewRatings` recomputes them on hide and restore). Its author still sees it in "My reviews".

### Promo codes

Platform promotions are `promotion` rows with no shop. They always have a code (unique among
platform codes), and cover every shop (`ALL`) or some marketplace categories (`CATEGORY`,
`targetIds` = category ids); `PRODUCTS` is refused. Checkout already tries a platform code
before a shop's code.

### Payouts

VirtualBiz collects online payments (KHQR, card) and keeps its commission (5 %,
`payment.commission`). Cash on delivery and counter sales never pass through VirtualBiz.

- A payment is **released** one day after its order was delivered or picked up
  (`vbiz.payouts.release-after`, `P1D`: the landing page promises payouts the next business
  day); before that it is **on hold**.
- A payment refunded after it was paid out (a return inside the 7-day window) is **taken back**
  from the next payout.
- `payable = released − commission − (taken back − its commission)`.
- Recording a payout needs the shop **VERIFIED** (`VERIFICATION_REQUIRED`) with a Bakong ID
  (`PAYOUT_ACCOUNT_MISSING`) and something to pay (`NOTHING_TO_PAY`). It locks the payments,
  writes a `payout` (gross, commission, amount, count, Bakong ID, the bank transfer reference)
  and marks them (`payment.payout_id` / `clawback_payout_id`). The transfer itself happens in
  the bank: staff record its reference.

## Audit log

Every action writes `admin_audit` in the same transaction: actor, action (`BUSINESS_VERIFIED`,
`BUSINESS_REJECTED`, `BUSINESS_SUSPENDED`, `BUSINESS_REINSTATED`, `USER_SUSPENDED`,
`USER_REINSTATED`, `USER_SIGNED_OUT`, `USER_ROLE_CHANGED`, `ORDER_CANCELLED`, `ORDER_REFUNDED`,
`REVIEW_HIDDEN`, `REVIEW_RESTORED`, `PROMOTION_CREATED`, `PROMOTION_UPDATED`, `PROMOTION_ENDED`,
`PAYOUT_RECORDED`), target, reason and details. Nothing edits or deletes it.

## Shops' side

- Re-verification: `PATCH /api/businesses/{id}` takes `idPhoto` (data URL) while the shop is not
  verified; it replaces the ID photo and puts the shop back to PENDING.
- Notifications (shop inbox): `BUSINESS_VERIFIED`, `BUSINESS_REJECTED {reason}`,
  `BUSINESS_SUSPENDED {reason}`, `BUSINESS_REINSTATED`, `PAYOUT_SENT {amount, bakongId,
  reference}`.
- Seller and provider settings show the ID check (with "Send a new ID photo") and payouts;
  provider settings also take a Bakong ID.

## Database

Flyway `V20261019_120000__platform_admin.sql`:
- `users.platform_role`, `users.suspended_at`, `users.suspended_reason`;
- `business.verification_note`, `verified_at`, `verified_by`, `suspended_at`, `suspended_reason`;
- `review.hidden_at`, `review.hidden_reason`;
- tables `payout` and `admin_audit`;
- `payment.payout_id`, `payment.clawback_payout_id`.

Local seed `V20261019_120100__seed_local_admin.sql`: `admin@virtualbiz.com` (super-admin, Sok
Vanna) and `support@virtualbiz.com` (admin, Chea Malis), password `Demo@1234`; Sreyleak Bakery,
a new shop waiting for its ID check; two earlier audit entries.
