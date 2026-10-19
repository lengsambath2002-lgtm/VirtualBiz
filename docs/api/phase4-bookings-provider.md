# API Phase 4: bookings, availability, clients, provider sales, team, deals, review replies

The contract between `backend/vbiz-api` and `frontend` for the customer's service bookings
(availability, book, reschedule, cancel) and the Service Provider workspace: the calendar
(appointments and blocks), clients, checkout sales, team shifts, deals and review replies, plus
the booking entries of the inbox and live stream. It builds on
[Phase 1](./phase1-auth-account-business.md), [Phase 2](./phase2-catalog-inventory.md) and
[Phase 3](./phase3-orders-checkout.md): same base path, `ApiResponse` envelope, `StatusCode`
names, bearer token and `X-Business-Id` tenancy.

Out of scope (Phase 5): the Seller POS (shifts, cash moves, counter sales and refunds), customers
writing reviews, seller promotions CRUD, seller review replies in the Seller workspace, the
seller's customer CRM. SMS reminders (`reminderHours`) need an SMS gateway and stay off until one
is configured (the same as the OTP SMS of Phase 1).

## Conventions

- **Booking numbers** are `BK-` + at least 5 digits from one sequence (`booking_number_seq`);
  **sale numbers** are `S-` + at least 5 digits (`sale_number_seq`). Both continue after the seed.
  Every `{ref}` path segment accepts the number or the id.
- **Dates and times** follow the domain model: `date` is a Phnom Penh calendar date
  (`YYYY-MM-DD`), `start` minutes from midnight, `durationMin` minutes. Instants are ISO-8601 UTC.
- **Money** is a JSON number, USD, 2 decimals (`NUMERIC(12,2)`).
- **Opening hours**: a staff member works `shifts[dow]` (or the shop's hours when they have no
  shifts) clipped to the shop's `hours[dow]`; a date in `closures` is closed. Monday is index 0.
- **Merchant calls** need a `SERVICE` business (`WRONG_BUSINESS_TYPE` otherwise), except the
  member, deal and review-reply endpoints, which work for both types. Any member may run the
  calendar, clients and checkout; team, deals and review replies need an owner or manager
  (`FORBIDDEN` for staff).
- **Stock**: retail lines of a sale take stock as `POS_SALE` through `inventory.service.StockWriter`
  (note = the sale number), exactly like the Seller POS.

## Appointment status

The Service Provider prototype's enum (open question #2). `AppointmentStatus.transitionTo` allows:

| From | To |
|---|---|
| `REQUESTED` | `BOOKED` (accept), `DECLINED`, `CANCELLED` (the customer withdraws) |
| `BOOKED` | `CONFIRMED`, `ARRIVED`, `NO_SHOW`, `CANCELLED` |
| `CONFIRMED` | `ARRIVED`, `NO_SHOW`, `CANCELLED` |
| `ARRIVED` | `STARTED`, `COMPLETED` (checkout), `NO_SHOW`, `CANCELLED` |
| `STARTED` | `COMPLETED` (checkout) |
| `NO_SHOW` | `BOOKED` ("Undo no-show") |
| `COMPLETED`, `CANCELLED`, `DECLINED` | — |

New appointments start at `REQUESTED` (online, auto-confirm off), `BOOKED` (online with
auto-confirm, or by phone) or `ARRIVED` (walk-in). `COMPLETED` is only reached through a sale.
Anything else answers `INVALID_STATUS_TRANSITION`. Requests do not hold a slot in the provider's
conflict check (the prototype shows them as overlapping), but they do in online availability so two
customers cannot request the same time.

## Shapes

```text
Appointment = {id, number, businessId, clientId, client: {id, name, phone, email?},
               serviceId, serviceName, staffId, date, start, durationMin, price,
               status, source: ONLINE|PHONE|WALK_IN, note?, saleId?, rescheduled,
               cancelReason?, log: [{code, params?, at}], createdAt}
Block       = {id, businessId, staffId, date, start, durationMin, reason: LUNCH|BREAK|TRAINING|PERSONAL|CLEANING}
Client      = {id, businessId, name, phone, email?, note?, since, userId?}
Sale        = {id, number, businessId, appointmentId?, clientId?, lines: [SaleLine],
               subtotal, discount, tip, total, payments: [{method: CASH|KHQR|CARD, amount}],
               cash?: {usd, khr, change}, byName, at}
SaleLine    = {serviceId?, variantId?, title, qty, unitPrice, staffId?}
Deal        = {id, businessId, title, body, discountPct?, serviceIds[], start: date, end: date,
               startsAt, endsAt, views}
ShopReview  = {id, targetType: PRODUCT|SERVICE, targetId, authorName, stars, text, tags[],
               variantName?, verified, reply?, at}
```

`log[].code` is rendered by the client in the viewer's language: `bookedOnline`, `bookedPhone`,
`bookedWalkin`, `accepted`, `declined` (`reason`), `confirmed`, `arrived`, `started`, `reset`
(no-show undone), `noShow`, `cancelled` (`reason`, `by: shop|client`), `edited`, `moved`
(`date`, `time`, `staff`), `paid` (`amount`, `method`), `rescheduled` (`to`: the new number).

Reason codes: decline `fullyBooked|stylistNA|notOffered`; provider cancel
`clientAsked|stylistUnavailable|shopClosed`; customer cancel `client`; a reschedule cancels the
old booking with `rescheduled`.

## Provider workspace (merchant: bearer + `X-Business-Id`)

### Appointments (`com.kosign.vbiz.booking`)

| Method & path | Body / query | Returns |
|---|---|---|
| GET `/api/appointments` | `from`, `to` (dates; default today − 60 … today + 90, at most 400 days) | `Appointment[]` by date and start |
| GET `/api/appointments/{ref}` | | `Appointment` |
| POST `/api/appointments` | `{clientId? \| client: {name, phone, email?}, serviceId, staffId, date, start, source: PHONE\|WALK_IN, note?}` | **201** `Appointment` (`BOOKED` / `ARRIVED`); a new client is created or found by phone |
| PATCH `/api/appointments/{ref}` | `{serviceId?, staffId?, date?, start?, note?}` | `Appointment`; duration and price follow the service; log `moved` when only the time / staff changed, else `edited` |
| POST `/api/appointments/{ref}/status` | `{status, reason?}` | `Appointment` — `BOOKED` (accept, or undo a no-show), `DECLINED` (reason), `CONFIRMED`, `ARRIVED`, `STARTED`, `NO_SHOW`, `CANCELLED` (reason) |
| POST `/api/appointments/{ref}/undo` | | `Appointment` — puts back what the last change (status, move or edit) replaced if it was made ≤ 30 s ago by this business (`UNDO_WINDOW_PASSED`); creation and payment cannot be undone |

The provider may double-book: the workspace shows the conflicts and asks first, the API records
what was decided. Only `PATCH` / status changes on terminal appointments are refused
(`INVALID_STATUS_TRANSITION`). Editing needs `REQUESTED`, `BOOKED`, `CONFIRMED` or `ARRIVED`.

### Blocks

| Method & path | Body | Returns |
|---|---|---|
| GET `/api/blocks` | `from`, `to` (as above) | `Block[]` |
| POST `/api/blocks` | `{staffId, date, start, durationMin (15–720), reason}` | **201** `Block` |
| DELETE `/api/blocks/{id}` | | empty |

### Clients (`com.kosign.vbiz.customer`)

| Method & path | Body | Returns |
|---|---|---|
| GET `/api/clients` | | `Client[]` by name |
| POST `/api/clients` | `{name, phone, email?, note?}` | **201** `Client`; `DUPLICATE_CLIENT` when the phone is already a client |
| PATCH `/api/clients/{id}` | `{name?, phone?, email?, note?}` (empty `email` / `note` clears) | `Client` |

Visits, spend, segments (VIP, new, at risk, no-show) stay derived on the client from appointments
and sales, as in the prototype.

### Sales (`com.kosign.vbiz.pos`)

| Method & path | Body / query | Returns |
|---|---|---|
| GET `/api/sales` | `from`, `to` (dates; default today − 90 … today) | `Sale[]` newest first |
| GET `/api/sales/{ref}` | | `Sale` |
| POST `/api/sales` | `{appointmentId?, clientId?, lines: [{serviceId? \| variantId?, title, qty, unitPrice, staffId?}], discount, tip, payments: [{method, amount}], cash?}` | **201** `Sale` |

Rules: 1–50 lines, `qty` 1–99, `unitPrice` ≥ 0 (the provider may change a price at the counter);
a service or variant must belong to the business; `discount` between 0 and the subtotal; `tip` ≥ 0;
`total = subtotal − discount + tip`, and the payments must add up to it (`VALIDATION_FAILED`,
`field: "payments"`). Variant lines take stock (`POS_SALE`; `INSUFFICIENT_STOCK` with a detail per
short line). With `appointmentId` the appointment must be `ARRIVED` or `STARTED`; it becomes
`COMPLETED` with `saleId` and a `paid` log entry, and the sale's client defaults to it.

### Team, deals, review replies

| Method & path | Body | Returns |
|---|---|---|
| POST `/api/businesses/{id}/members` | `{name, title?, color?, shifts?}` | **201** `Member` (role `STAFF`, no account) |
| PATCH `/api/businesses/{id}/members/{memberId}` | `{name?, title?, color?, shifts?, active?}` | `Member`; the owner cannot be deactivated |
| GET `/api/deals` | | the shop's `Deal[]` (all, newest start first) |
| POST `/api/deals` | `{title, body?, discountPct?, serviceIds[], start, end}` (dates; `body` may be empty) | **201** `Deal` — runs from `start` 00:00 to `end` 24:00 Phnom Penh |
| PATCH `/api/deals/{id}` | same fields, optional | `Deal` |
| DELETE `/api/deals/{id}` | | empty |
| GET `/api/reviews` | | the shop's `ShopReview[]`, newest first |
| POST `/api/reviews/{id}/reply` | `{text}` (empty clears) | `ShopReview` |

`shifts`: 7 entries, `[startMin, endMin]` or `null`, Monday first (`VALIDATION_FAILED` when
`end ≤ start`). `color` is `#RRGGBB`. A deal's `serviceIds` must be the shop's services.

Booking rules, opening hours, closures and the shop details keep using
`PATCH /api/businesses/{id}` (Phase 1): `bookingSettings` (`onlineBooking`, `autoConfirm`,
`reminderHours`, `minNoticeHours`, `freeCancelHours`, `bufferMinutes`), `hours`, `closures`.

## Customer

### Availability (public, `com.kosign.vbiz.booking`)

GET `/api/marketplace/items/{slug}/availability?from=YYYY-MM-DD&days=7&staffId=`

```text
Availability = {serviceId, durationMin, step: 30,
                days: [{date, open, slots: [{start, staffIds[]}]}]}
```

Slots run every 30 minutes from opening while `start + durationMin` fits the day's hours. A
`staffIds` entry is a member who performs the service, works then (shift ∩ hours, no closure) and
has no overlapping appointment (`REQUESTED` counts, buffer included) or block. Today's slots before
`now + minNoticeHours` are empty. `days` is 1–14; `staffId` narrows the answer to one member.
`LISTING_NOT_FOUND` when the slug is not a service.

### Bookings (`/api/me/bookings`, signed in)

```text
Booking = {id, number, status, rescheduled, cancelReason?,
           service: {id, slug, name}, shop: {id, slug, name, phone, street, district},
           staff?: {id, name}, date, start, durationMin, price, note?,
           createdAt, freeCancelUntil, canChange}
```

| Method & path | Body | Returns |
|---|---|---|
| GET `/api/me/bookings` | | `Booking[]` (upcoming first by time, then past newest first) |
| GET `/api/me/bookings/{ref}` | | `Booking`; `APPOINTMENT_NOT_FOUND` for someone else's |
| POST `/api/me/bookings` | `{service (slug or id), staffId?, date, start, name, phone, note?, replaces?}` | **201** `Booking` |
| POST `/api/me/bookings/{ref}/cancel` | | `Booking` (`CANCELLED`, reason `client`) |

Booking rules: the shop is online with `onlineBooking` on and the service `bookableOnline`
(`BOOKING_UNAVAILABLE`); the slot is still free for the chosen member, or for at least one member
when `staffId` is empty (the first free one is picked) — else `SLOT_UNAVAILABLE` with
`meta.reason` = `taken`, `notice` (inside the minimum notice), `closed` or `outside`. The price is
the service price less its `discountPct`. The customer becomes (or is matched to, by account then
phone) a client of the shop. `replaces` reschedules: the old booking (same customer, still
changeable) is cancelled with reason `rescheduled` in the same transaction and logs `rescheduled`.

`canChange` (and cancel / reschedule) needs `REQUESTED`, `BOOKED` or `CONFIRMED` and
`now < freeCancelUntil` = start − `freeCancelHours` (`CANCEL_WINDOW_PASSED`).

## Notifications and live updates

New inbox kinds (Phase 3 inbox endpoints): shop — `BOOKING_REQUESTED` (`number`, `name`,
`service`, `date`, `time`), `BOOKING_CANCELLED` (`number`, `name`, `reason`); customer —
`BOOKING_REQUESTED` and `BOOKING_CONFIRMED` (`number`, `shop`, `service`, `date`, `time`),
`BOOKING_DECLINED` (`reason`), `BOOKING_CANCELLED` (`reason`), `BOOKING_CHANGED` (`date`,
`time`). Routes: `/bookings/BK-…` (customer), `/provider/calendar?date=…&appt=<id>` (shop).
`NEW_REVIEW` (`name`, `stars`) is the provider's review entry.

Stream event `appointment` `{id, number, businessId, status}` goes to the shop and, when the
client has an account, to that customer, after every create, change, undo and checkout.

## New status codes

| Code | HTTP | When |
|---|---|---|
| `SLOT_UNAVAILABLE` | 409 | The time is taken, too soon, closed or outside hours (`meta.reason`) |
| `BOOKING_UNAVAILABLE` | 409 | The shop or service does not take online bookings |
| `DUPLICATE_CLIENT` | 409 | Another client of the shop has that phone |

`CANCEL_WINDOW_PASSED` and `UNDO_WINDOW_PASSED` (Phase 3) are reused with the booking windows.
