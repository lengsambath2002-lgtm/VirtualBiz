# ARCHITECTURE — System Architecture

> The layout follows WeHR (WGPP), per [ADR-0001](./docs/adr/0001-project-structure.md). The domains come from the six VirtualBiz prototype artifacts, which are listed in [docs/prd/prototype-inventory.md](./docs/prd/prototype-inventory.md).

## 0. Product in one paragraph

VirtualBiz is a local marketplace for Phnom Penh. Customers can **shop** products for delivery or pickup and **book** services such as salons, spas and repairs. Merchants run a **Seller** workspace (online orders, POS and inventory) or a **Service Provider** workspace (staff calendar, appointments and checkout). Every user has **one account** that can be a customer and, optionally, run a business. Customers pay with KHQR (Bakong), card or cash. Money is in USD with riel shown alongside (1 USD ≈ 4,100 KHR, riel rounded to 100). VirtualBiz charges 5% on online sales and nothing on counter sales.

## 1. i18n

- Supported languages: **en (default) / kh**. Single source: `SUPPORTED_LOCALES` in `frontend/src/lib/i18n/config.ts`.
- The frontend uses `next-intl`, with messages in `frontend/messages/{en,kh}.json`. Keys are named `<surface>.<id>`, for example `seller.orders.accept`.
- The backend returns errors as `StatusCode` names. The client translates them.
- Money formatting (USD + KHR, and change worked out as dollars plus riel) lives in one place, `frontend/src/lib/money/`, with matching helpers in `vbiz-common` and `VBizDomain`.

## 2. Overall Composition

```
┌─────────────────────────────── Next.js (one app) ───────────────────────────────┐
│ (marketing)  (auth)  (shop)            (onboarding)      (seller)     (provider)│
│  landing     sign-in customer market   create-business   seller ws    salon ws  │
└──────────────────────────────────────┬──────────────────────────────────────────┘
         iOS (SwiftUI) · Android (Compose)│  REST + JWT · SSE for live order/booking updates
┌──────────────────────────────────────▼──────────────────────────────────────────┐
│ Spring Boot · vbiz-api   com.kosign.vbiz.<domain>                               │
│  auth · account · business · catalog · inventory · marketplace · cart · order   │
│  delivery · booking · pos · payment · promotion · customer · review             │
│  notification · report · storage · meta                                         │
│ vbiz-common: ApiResponse · error · security · tenancy (per business) · audit    │
└────────┬────────────┬──────────────┬──────────────┬──────────────┬──────────────┘
    PostgreSQL     MinIO (photos,   KHQR / Bakong   SMS gateway    Google OAuth
                   ID documents)    (+ card terminal) (OTP, reminders) · SMTP
```

## 3. Surfaces × Domains

| Prototype artifact | Route group (`src/app/[locale]/`) | Feature slices (`src/features/`) | Backend domains |
|---|---|---|---|
| VirtualBiz (landing) | `(marketing)` | `landing` | `meta` (districts, categories, fee calculator) |
| Sign-in | `(auth)/sign-in` | `auth` | `auth`, `account` |
| Customer | `(shop)/…` (home, search, p, s, shop, deals, cart, checkout, orders, bookings, account) | `shop-*`, `khqr-payment` | `marketplace`, `catalog`, `cart`, `order`, `booking`, `delivery`, `payment`, `promotion`, `review` |
| Create Business | `(onboarding)/create-business` | `business-onboarding` | `business` (KYC, Bakong ID, slug) |
| Seller | `(seller)/seller/…` (home, pos, orders, products, inventory, promotions, customers, reviews, settings) | `seller-*`, `barcode-scanner`, `command-palette` | `order`, `catalog`, `inventory`, `pos`, `promotion`, `customer`, `review`, `report`, `delivery` |
| Service Provider | `(provider)/provider/…` (home, calendar, sales, clients, services, team, marketing, settings) | `provider-*`, `command-palette` | `booking`, `business` (staff, hours), `pos` (checkout sale), `customer`, `promotion`, `review`, `report` |

Shared UI: `src/components/glass` (the prototypes' Liquid Glass layer: tab bar, rail, sheets) plus `src/components/ui` and `src/components/layout`.

## 4. Backend domains

Each domain is `com.kosign.vbiz.<domain>/{controller,service,repository,domain,payload,mapper,event}`.

| Domain | Owns |
|---|---|
| `auth` | Email + password, Google, email OTP, SMS OTP, reset, JWT and refresh (30 days), log out everywhere, lockout (5 tries) |
| `account` | User profile, addresses, saved items and followed shops, notification preferences, active role |
| `business` | Business (product or service type), onboarding draft, location, hours, closures, Bakong ID, ID verification, slug, members (Owner / Manager / Staff), staff shifts |
| `catalog` | Products, options, variants (SKU, barcode, price, compare-at, cost), photos, services (duration, price, staff, bookable online), categories |
| `inventory` | Per-variant stock and the **single stock-movement log**, shared by online orders and POS |
| `marketplace` | Search, filters, shop pages, deals and events feed, distance by district |
| `cart` | Multi-shop cart, saved-for-later, promo application |
| `order` | Order per shop: new → accepted → packed → shipped → delivered / picked up / cancelled / returned. Pack verification, auto-cancel after 1 h (`scheduler/`) |
| `delivery` | Rider vs own delivery, zone fees, free-over threshold, COD collection, live tracking |
| `booking` | Appointments: requested → booked → confirmed → arrived → started → completed (or no-show / cancelled / declined), blocks, availability, reminders (`scheduler/`) |
| `pos` | Shifts, cash drawer (USD + KHR), held sales, split tender, receipts, refunds, offline sale sync (`sync/`) |
| `payment` | KHQR / Bakong (`khqr/`), card, cash / COD, refunds, 5% commission, next-business-day payouts |
| `promotion` | Seller promos (code or automatic, %, fixed or shipping), provider deals, platform codes |
| `customer` | Per-business CRM: customers and clients, notes, segments (VIP, new, lapsed, no-show) |
| `review` | Ratings, quick tags, verified purchase, merchant replies |
| `notification` | In-app inbox, SSE (`sse/`), SMS (`sms/`), email, receipts by SMS or Telegram |
| `report` | Sales KPIs, charts, best sellers, by payment method and by staff, tips |
| `storage` / `meta` | File uploads / reference data (districts, categories, KHR rate) |

`vbiz-common/tenancy` scopes every merchant request to the business the user is acting for. A customer request is scoped to the user.

**Security (as built, Phase 1).** Stateless: a 15-minute HS256 access token (`Authorization: Bearer`) plus a rotating 30-day refresh token in the httpOnly `vb_refresh` cookie (`Path=/api/auth`), stored hashed in `user_session`; reuse of a rotated token revokes its family. `vbiz-common/security` holds the JWT codec and filter and writes 401/403 in the `ApiResponse` envelope; `vbiz-common/tenancy/TenancyFilter` reads `X-Business-Id` and checks membership through `TenantMembershipChecker` (implemented by `business`). The filter chain is `vbiz-api/config/SecurityConfig`. API docs: `/api/docs` (Swagger UI), `/api/docs/openapi.json`.

**Catalog and stock (as built, Phase 2).** Listings (products, services) and shops have platform-unique slugs that the customer URLs and saved-item keys use. Every stock change goes through `inventory.service.StockWriter`: it locks the variant row, refuses negative stock and appends the `stock_movement` row in the same transaction; `ProductVariant` has no stock setter and `ArchitectureTest` fails if anything else calls `adjustStock`. Until the order and POS domains exist, the seller workspace's local order / POS screens send their movements (`POS_SALE`, `POS_REFUND`, `ORDER_CANCELLED`) to `POST /api/inventory/movements`, so online and counter sales already share one server count. Marketplace search filters in SQL over the `marketplace_listing` view (`pg_trgm` indexes) and sorts / measures distance in `marketplace.service`. Contract: [docs/api/phase2-catalog-inventory.md](./docs/api/phase2-catalog-inventory.md).

**Orders and live updates (as built, Phase 3).** Checkout makes one order per shop (`VB-` numbers from `order_number_seq`) and takes stock through `StockWriter` in one call; status changes lock the order row and go through `OrderStatus.transitionTo`. `order.scheduler.OrderJobs` auto-cancels unaccepted orders after 1 h and expires KHQR intents. Inbox entries (`notification`) and live events go out after commit through `notification.sse.StreamHub` (in memory, one API instance); browsers trade their bearer token for a single-use stream ticket. Contract: [docs/api/phase3-orders-checkout.md](./docs/api/phase3-orders-checkout.md).

**Bookings and the provider workspace (as built, Phase 4).** `booking` owns appointments (`BK-` numbers from `booking_number_seq`), their activity log (`appointment_event`, which also holds the snapshot the 30-second Undo restores) and calendar blocks; `booking.service.Availability` is the one pure rule for free times (shift ∩ opening hours, closures, buffer, blocks, minimum notice) behind the public availability endpoint and online booking, which takes a per-business advisory lock so two customers cannot take the same slot. `customer` holds each service business's clients (matched to online bookers by account, then phone). `pos` stores the provider's checkout sales (`S-` numbers); retail lines go through `StockWriter` and an appointment sale completes the appointment in the same transaction. The provider workspace no longer persists anything in the browser: it loads from the API when it opens and the shop's stream (`appointment`, `sale`, `block`, `notification`) keeps it current. Contract: [docs/api/phase4-bookings-provider.md](./docs/api/phase4-bookings-provider.md).

**Register, promotions, reviews (as built, Phase 5).** `pos` also runs the Seller register: shifts with a counted float and cash moves (`pos_shift`, `pos_cash_move`; one open shift per shop), counter sales as `R-` receipts in the shared `sale` tables and per-line refunds; `POS_SALE` / `POS_REFUND` are server-only stock reasons written through `StockWriter`. The register makes each sale's id itself (`client_ref`, unique per shop), records it locally at once and sends it, so a sale rung up offline and sent twice is stored once. `promotion` serves the shop's promotions; checkout applies a shop's best automatic promotion (no code) next to a promo code. Customers review items from delivered orders and completed bookings (`review.order_id` / `appointment_id`), which updates the item's and the shop's rating. A product shop's clients are the accounts that ordered from it (linked when an order is placed). The frontend has no mock data left. Contract: [docs/api/phase5-pos-promotions-reviews.md](./docs/api/phase5-pos-promotions-reviews.md).

**Images (as built, Phase 6).** `storage` takes image uploads (`POST /api/files`; JPEG / PNG / WebP checked by content), records them in `stored_file` and keeps the bytes in a `FileStore` (local disk at `VBIZ_STORAGE_DIR` today; one shared volume, or object storage, before running more than one API instance). Profile, cover and logo fields only take the caller's own upload of the right purpose (`StorageService.requireOwnImage`). The frontend uploads through `lib/api/files.ts` and the `useImageUpload` hook, and the shared `components/media/ShopPhotos` edits a business's logo and cover in both workspaces. Contract: [docs/api/phase6-files-profiles.md](./docs/api/phase6-files-profiles.md).

**Not found, errors and empty states.** Every surface uses `src/components/feedback`: `NotFoundView`, `ErrorView` (offline vs. server error, retry, request reference), `LoadFailed` (404 → not found, else error) and `EmptyView` / `EmptyRow`. Each surface has a catch-all route that calls `notFound()` plus its own `not-found.tsx` and `error.tsx`, so a 404 or a crash keeps the surface's header and menus; `[locale]/not-found.tsx`, `[locale]/error.tsx`, `app/not-found.tsx` and `app/global-error.tsx` are the fallbacks. A failed load must never look like an empty list.

**Super-admin console (as built, Phase 7).** `admin` serves `/api/admin/**` to staff (`users.platform_role` ADMIN / SUPER_ADMIN, checked by `AdminAccess` in every service method; no `X-Business-Id`). Lists and figures across every shop are SQL in `admin.repository.AdminQueries`; actions go through the owning domain (`OrderService.adminCancel` / `adminRefund` keep stock in `StockWriter` and refunds in `PaymentService`, `ReviewRatings` recomputes ratings) and each writes `admin_audit` in the same transaction. Payouts settle released online payments into `payout` rows. The JWT filter checks the session (`common.security.SessionValidator`, implemented in `auth`) on every request, so suspending an account or signing it out everywhere takes effect at once. Frontend: route group `(admin)`, features `admin-*`, sharing the seller workspace's styles. Contract: [docs/api/phase7-admin.md](./docs/api/phase7-admin.md).

## 5. Mobile

- **iOS:** the `VirtualBiz/` app target holds `Shell` (tabs, role switch), `Platform` (keychain, camera, connectivity) and `Features/` (SignIn, Home, Explore, Deals, Cart, Checkout, Orders, Bookings, Account, CreateBusiness, SellerPOS, SellerOrders, SellerInventory, ProviderCalendar, Notifications). The `Packages/VirtualBizKit` package holds VBizAPI (generated), VBizData, VBizDomain and VBizDesignSystem.
- **Android:** `app/` plus `core/{api,data,domain,designsystem}` and `feature/`. Android follows iOS.
- Planned mobile-only features: camera barcode scanning and push notifications. The POS must queue sales while offline.

## 6. Permission Model

| Role | Scope |
|---|---|
| Customer | Their own orders, bookings, addresses, reviews |
| Business Owner | Everything in their business, including payouts and settings |
| Manager | Daily operations in their business |
| Staff | POS, orders and calendar. No payouts or settings. |

The server checks permissions with `@PreAuthorize` plus the tenancy filter. The client hides menus based on the server's response.

## 7. Database

- PostgreSQL 15 or later, with Flyway migrations: `backend/vbiz-api/src/main/resources/db/migration/V<YYYYMMDD>_<HHMMSS>__<desc>.sql`. Never edit a migration once it's merged.
- Store times in UTC (`TIMESTAMPTZ`) and display them in `Asia/Phnom_Penh`. Store money as `NUMERIC(12,2)` USD. KHR is derived, not stored, except for cash tendered at the POS.

## 8. Environments

| Environment | Profile | Purpose |
|---|---|---|
| local | `local` | Developer PC. API on port 8180, PostgreSQL on 127.0.0.1:5433. Flyway runs automatically, including the demo seed (`classpath:db/seed-local`). OTP codes come back as `devCode`. |
| dev | `dev` | Shared development. OTP codes come back as `devCode` until an SMS / email gateway exists. |
| uat | `uat` | A push to `uat` deploys it |
| prod | `prod` | A push to the protected `prod` branch deploys it |

## 9. ADR

Decisions are in [docs/adr/](./docs/adr/). Questions the prototype leaves open are in [docs/prd/prototype-open-questions.md](./docs/prd/prototype-open-questions.md).
