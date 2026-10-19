# Domain model (canonical)

This is the single source for entity names, fields and enums. The frontend (`frontend/src/lib/domain/`), backend (`com.kosign.vbiz.<domain>.domain`) and iOS (`VBizDomain`) all mirror it. Where the prototypes conflict, the resolution follows [prototype-open-questions.md](../prd/prototype-open-questions.md).

## Conventions

- **IDs:** strings. Display numbers: order `VB-00001`, booking `BK-00001`, POS receipt `R-00001`, provider sale `S-00001`.
- **Money:** USD decimal with 2 places (`amount`). KHR is derived as `round(usd × 4100 / 100) × 100`, with the rate in `meta`.
- **Time:** ISO-8601 UTC instants. Displayed in `Asia/Phnom_Penh`. Times of day are minutes from midnight (`start: 630` = 10:30).
- **Phone:** stored normalized as `0XXXXXXXX`, validated with `^0[1-9]\d{7,8}$`. `+855` and `855` are normalized to `0`.
- **Enums:** wire values are `UPPER_SNAKE` in Java and JSON. TypeScript uses the same string literals. Swift uses `camelCase` cases with `UPPER_SNAKE` raw values.

## Enums

| Enum | Values |
|---|---|
| `BusinessType` | `PRODUCT`, `SERVICE` |
| `MemberRole` | `OWNER`, `MANAGER`, `STAFF` |
| `VerificationStatus` | `PENDING`, `VERIFIED`, `REJECTED` |
| `SignInMethod` | `PASSWORD`, `GOOGLE`, `EMAIL_CODE`, `PHONE_SMS` |
| `OtpPurpose` | `VERIFY`, `LOGIN`, `RESET`, `PHONE` |
| `ProductStatus` | `ACTIVE`, `DRAFT` |
| `OrderStatus` | `NEW`, `ACCEPTED`, `PACKED`, `SHIPPED`, `DELIVERED`, `PICKED_UP`, `CANCELLED`, `RETURNED` |
| `FulfilmentMethod` | `DELIVERY`, `PICKUP` |
| `DeliveryProvider` | `VIRTUALBIZ_RIDER`, `OWN_DELIVERY` |
| `PaymentMethod` | `KHQR`, `CARD`, `CASH` |
| `PaymentChannel` | `ONLINE`, `COD`, `POS` |
| `AppointmentStatus` | `REQUESTED`, `BOOKED`, `CONFIRMED`, `ARRIVED`, `STARTED`, `COMPLETED`, `NO_SHOW`, `CANCELLED`, `DECLINED` |
| `AppointmentSource` | `ONLINE`, `PHONE`, `WALK_IN` |
| `BlockReason` | `LUNCH`, `BREAK`, `TRAINING`, `PERSONAL`, `CLEANING` |
| `StockReason` | `RECEIVED`, `COUNT_CORRECTION`, `DAMAGED_LOST`, `CUSTOMER_RETURN`, `ORDER_CANCELLED`, `ORDER_SALE`, `POS_SALE`, `POS_REFUND`, `QUICK_ADJUST`, `OPENING_STOCK`, `MARKED_SOLD_OUT` |
| `PromotionType` | `PERCENT`, `FIXED`, `FREE_SHIPPING` |
| `PromotionScope` | `ALL`, `CATEGORY`, `PRODUCTS` |
| `PromotionState` | `ACTIVE`, `SCHEDULED`, `USED_UP`, `ENDED` (derived) |
| `AddressLabel` | `HOME`, `WORK`, `OTHER` |

### Customer-facing order labels

The customer sees these labels for each `OrderStatus`:

- `NEW` → Order placed
- `ACCEPTED` → Preparing
- `PACKED` → Ready for pickup / Ready
- `SHIPPED` → On the way
- `DELIVERED` → Delivered
- `PICKED_UP` → Picked up
- `CANCELLED` → Cancelled
- `RETURNED` → Returned

## Entities

| Entity | Fields |
|---|---|
| **User** | `id, name, email?, phone?, avatarUrl?, coverUrl?, signInMethods[], platformRole? (ADMIN / SUPER_ADMIN, staff only), suspendedAt?, createdAt` |
| **Address** | `id, userId, label, name, phone, line, district, note?, lat?, lng?, isDefault` (lat/lng = map pin, WGS84, `NUMERIC(9,6)`) |
| **District** | `id, name, km` (km from the centre, used for distance sorting). Seed: Toul Kork, BKK1, Daun Penh, Chamkar Mon, Sen Sok, Russey Keo, Chbar Ampov, Mean Chey, Por Senchey, Prampi Makara |
| **Category** | `id, name, icon, tint (1–6), businessType` |
| **Business** | `id, ownerId, type, name, slug, categoryId, about?, phone, email?, district, street, lat?, lng?, hours[7] ([open,close] minutes, or null when closed), closures[{date, reason}], online, logoUrl?, coverUrl?, bakongId? (optional since Phase 6), verification, verificationNote?, suspendedAt?, suspendedReason?, rating, reviewCount, since` |
| **ProductSettings** (Business with `type=PRODUCT`) | `autoAccept, prepMinutes, lowStockDefault, pickup, cod, freeDeliveryOver?, zones[{label, districts[], fee}]` |
| **BookingSettings** (Business with `type=SERVICE`) | `onlineBooking, autoConfirm, reminderHours, minNoticeHours, freeCancelHours, bufferMinutes` |
| **BusinessMember** | `id, businessId, userId?, name, role, title?, color?, shifts[7] ([start,end] or null), active` |
| **Product** | `id, slug, businessId, title, description, categoryId, collection?, status, options[{name, values[]}], variants[], photos[], specs{label: value}, lowStockAt, sold, rating` |
| **Collection** | `id, businessId, name` (shop-defined groups, open question #11 level 2) |
| **Variant** | `id, productId, options{name: value}, price, compareAt?, cost?, sku, barcode, stock, swatch?` |
| **Service** | `id, slug, businessId, name, category, description, durationMin, price, staffIds[], bookableOnline, discountPct?, sold, rating` |
| **StockMovement** | `id, variantId, delta, reason, byUserId?` (null = automatic), `byName?, note?, at` |
| **SavedEntry** | `userId, type (PRODUCT \| SERVICE \| SHOP), targetId, savedAt` (client key: listing slug or `shop:` + shop slug) |
| **CartLine** | `id, variantId, qty, selected, savedForLater` |
| **Order** | `id, number, businessId, customerId, lines[{variantId, title, variantName, qty, unitPrice}], subtotal, discount, promoCode?, deliveryFee, total, payment{method, channel, paid}, method, address?, scheduledFor? (null = ASAP), note?, status, timeline[{status, at}], rider?{name, vehicle, plate}, cancelReason?, reviewed, createdAt` |
| **Appointment** | `id, number, businessId, clientId, serviceId, staffId, date, start, durationMin, price, status, source, note?, log[{code, params?, at}], saleId?, customerId?` (`customerId` = the account that booked online; `log` codes are rendered by the client, see docs/api/phase4-bookings-provider.md) |
| **Block** | `id, businessId, staffId, date, start, durationMin, reason` |
| **Client / Customer (CRM)** | `id, businessId, userId?, name, phone, email?, note?, district?, since, tags[]` (phone unique per business; `userId` links an online booker's account). Order count, spend and last visit are derived. |
| **PosSale** | `id, number, businessId, shiftId, lines[{variantId?, serviceId?, title, qty, unitPrice, staffId?}], subtotal, discount, tip, total, payments[{method, amount}], cash?{usd, khr, change}, customerId?, refunds[{at, amount, method, lines}], at` (Phase 4 stores the provider's checkout sales as `sale` + `sale_line` + `sale_payment` with an optional `appointmentId`; `shiftId` joins with the Seller POS in Phase 5) |
| **Shift** | `id, businessId, openedBy, openedAt, floatUsd, floatKhr, moves[{type: IN\|OUT, amount, note}], closedAt?, countedUsd?, difference?` |
| **Promotion** | `id, businessId?` (null = platform-wide), `name, type, value, code?` (null = automatic), `scope, targetIds[], minSpend?, maxDiscount?, startsAt, endsAt, uses, usageLimit?` |
| **Deal (event)** | `id, businessId, title, body, discountPct?, serviceIds[], startsAt, endsAt, views` |
| **Review** | `id, businessId, targetId (product or service), authorId, stars, text, tags[], variantName?, verified, reply?, at` |
| **Notification** | `id, userId, text, route, unread, at` |

## Business rules (from the prototype)

- **Delivery:** the fee is the shop's zone fee for the customer's district. Delivery is free when the shop subtotal is at least `freeDeliveryOver`. Pickup is free.
- **Orders:**
  - An order not accepted within 1 h is auto-cancelled.
  - The customer may cancel while `NEW` and within 5 minutes.
  - Returns are allowed within 7 days of delivery.
- **Checkout:** creates one order per business.
- **Bookings:**
  - A booking request goes to `REQUESTED`, or straight to `BOOKED` when the shop has auto-confirm on.
  - The customer may cancel or reschedule until `freeCancelHours` before the start.
  - Walk-ins start at `ARRIVED`.
- **POS:**
  - Uses the same `StockMovement` log as online orders.
  - A shift is balanced when |difference| ≤ $0.25.
- **Commission:** 5% on `ONLINE` channel payments only.
- **Auth:**
  - OTP is 6 digits, valid for 10 minutes, with a 30 s resend and 5 attempts.
  - 5 wrong passwords lock sign-in for 30 s.
  - The refresh token lasts 30 days.
