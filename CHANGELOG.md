# Changelog

All notable changes are recorded here. Format: [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Fixed

- Product shop settings changed on another device or by another team member now show up when the workspace opens (they were kept from the browser's saved copy).
- Team members with no colour (the owner added when a shop opens) showed as an empty ring in the provider workspace. They now get a steady colour from the team palette.
- The provider's online requests no longer promise clients an SMS; they hear back in their VirtualBiz inbox.
- Signed out while moving between pages: a sign-in renewal cut off by navigation (or lost to a network blip or a server error) was treated as a rejected session and cleared it. Only a 401 / 403 from the server signs the user out now.
- Seller forms: a field next to one showing an error no longer stretches and drops out of line. Adjust stock's quantity has −/+ and quick amounts (+1, +5, +10, +50) and takes digits only.
- Create Business: a second shop could not be created, and another account on the same browser could not create one. The wizard's draft was shared by everyone on the browser and stayed on the "open" screen after a shop opened (and kept that shop's id, so the next "Open my shop" created nothing). The draft now belongs to the account that started it, and a finished draft starts a new shop unless the done screen was just reached (e2e "One account, many shops").

### Added

- Shop lists, imports and exports (docs/api/phase16-shop-lists.md): product shops reach every order (done, cancelled and all orders page on the server with search, fulfilment, payment, source and date filters, sorting and an export of exactly that view; before, only the latest 60 could be seen). Customers in both workspaces page on the server with lifetime orders or visits and spend, VIP / new / at-risk segments worked out over all history, filters in the URL, Add customer and CSV import. Products import from CSV (update price, cost and counted stock by SKU, or add new products), with a dry run showing each row's problems first, and can be published, moved to draft or deleted in bulk.
- Management lists (docs/api/phase15-lists.md): one shared table, paginator and filter bar for every list. In the super-admin console every list now sorts by its columns on the server, filters by date (presets or custom days) and new fields (shop category and district, order fulfilment and payment, replied reviews, audit action), pages with page numbers and a rows-per-page choice, keeps all of it in the URL, and exports exactly what it shows as CSV (audited). Shops, accounts and reviews can be selected and verified, rejected, suspended, reinstated, signed out, hidden or shown in bulk, each row audited and refused rows reported. Promo codes and payout balances page and search too, and the payout totals no longer depend on what's loaded.
- Customer records and exports (docs/api/phase14-customers-exports.md): shops edit a customer's name, phone, email, district and private note from the customer drawer (product shops could not edit customers at all before). **Settings → Export data** downloads orders, sales, products, bookings and customers as CSV for a chosen period, ready for Excel in Khmer and safe from spreadsheet formulas; owners and managers only, and every export is logged.
- Messages that really go out (docs/api/phase13-messages.md): receipts from the register and the service checkout are shared as a private link (Telegram, SMS, copy, print) that opens a public receipt page; the product invoice's **Email invoice** opens the customer's mail app with the order filled in. A salon's decline message is saved and shown to the customer in their inbox and on the booking page. Booked clients get one reminder before their visit at the shop's reminder hours (inbox notification, plus an SMS through a logging stub until a provider is contracted).
- Catalog structure (docs/api/phase12-catalog-structure.md): product shops manage their collections (add, rename, reorder, delete choosing where the products go) from Products → Collections, and a new shop starts with collections for its category instead of electronics for everyone. Service providers manage their service categories (add, rename with services following, reorder, remove unused) instead of a fixed Hair / Nails / Make-up list, and services get a description.
- Shop settings (docs/api/phase11-shop-settings.md), the same panels in both workspaces: location and contact (district, street, email, map pin with "use my location"), opening hours to the quarter hour with closed dates, and a shop policy: receipt header and footer, VAT rate and number (receipts show the VAT inside the total), which payment methods the counter takes, and social links. Product shops also edit delivery zones in full (add, rename, districts, fee) and their return window; service providers set the start-time interval, how far ahead clients book, reminder timing and tip choices. The register and service checkout only offer accepted methods (the API refuses others), receipts print the shop's text and the actual cashier, and the provider calendar spans the shop's real hours.
- Shop teams (docs/api/phase10-shop-team.md): owners invite managers and staff by email; each person signs in with their own account. A new **Team** page in the product shop workspace and a **People and access** panel in the provider team page show who has access, change roles (owner only), give an existing calendar member a login, remove or restore access, and withdraw invites. Roles are enforced by the API: managers run the shop and invite staff but can't change the payout account or roles; staff see settings read-only.
- Staff security (docs/api/phase9-staff-security.md):
  - **Two-step sign-in (TOTP) for staff**: required before the console opens, checked again every 12 hours and on every new sign-in. Set-up shows a QR code and the key, then 10 one-time recovery codes. Keys are encrypted at rest (AES-256-GCM, `VBIZ_DATA_KEY`), codes can't be replayed, and 5 wrong codes sign the session out.
  - **Staff invites**: a super-admin invites by email with a role; the single-use link (7 days) lets a new person join with a 12+ character password, or an existing account confirm itself with its password.
  - **Settings → Staff**: your own two-step status and new recovery codes, the staff list (role, two-step, last active), changing roles, removing staff, resetting two-step sign-in for a lost phone (reason required, signs them out), and pending invites to withdraw.
  - **First super-admin**: a new environment creates it on start from `VBIZ_BOOTSTRAP_ADMIN_*`, with a password that must be changed at first sign-in. No demo accounts outside the local profile.
  - The last active super-admin can't be demoted or suspended. Staff passwords need 12+ characters. Every step is in the audit log.
- Super-admin console:
  - **Settings**: commission %, payout delay and the riel exchange rate are database settings a super-admin changes from the console (other staff see them read-only). Saving asks first and the audit log records old → new values. They replace `vbiz.payment.commission-pct`, `vbiz.payouts.release-after` and the frontend's fixed 4,100 rate.
  - **Categories**: add, rename (English and Khmer), pick icon and colour, show or hide in the marketplace, reorder. The storefront reads names from the API, so a new category needs no deploy.
  - **Overview**: a 7 / 30 / 90-day switch kept in the URL, KPIs with sparklines and average order value, "New" or "N×" instead of huge percentages, queue cards that turn green when clear, a sales / orders chart with hover details, top shops with share bars, sales by category, growth, and a refresh every minute.
  - **Audit log**: grouped by day, with an icon and tone per action and settings changes shown as old → new.
  - Shop, user and order lists: each row's name is a real link (Cmd / Ctrl-click opens a new tab).
- Pages now follow the platform settings: the landing pricing card and fee calculator use the current commission; the payout timing on the landing page, seller settings and console Payouts page uses the current payout delay; every riel amount uses the current rate.
- Provider Services page redesign: search and category chips, an "Add to <category>" button per table (opens the form with it chosen), team avatars with names (or "No one assigned"), 30-day bookings with a bar, Online / Hidden next to the switch, a deal's discount under the price, inline actions, phone cards, and retail products as a shelf of cards with stock.
### Added

- Language switcher (English / ខ្មែរ) in the marketplace header and the seller, provider and admin top bars. It keeps the current page, and shows just the flag on phones. Workspace top bars now shorten a long shop name on phones instead of pushing the bell off-screen.
- Seller products: **Add product** opens a quick-add popup (photos, name, category, description, price / compare-at / cost with the margin, opening stock, SKU, barcode, live or draft); the full editor stays for sizes, colours and editing. The products table is redesigned: product with variant / SKU / barcode, stock with a level bar against the low-stock alert, category chip, price with the compare-at struck through, sortable columns, row actions (edit, adjust stock, duplicate) and cards on phones. The recent stock changes table is redesigned the same way (e2e `products.spec.ts`).
- Manual orders (`docs/api/phase8-manual-orders.md`): Seller **New → Manual order** for orders taken by phone, Facebook, Telegram or at the counter. Items by search or barcode, customer and address, delivery fee from the shop's zones, discount, cash on delivery or paid up front (cash / KHQR to the shop). The order starts accepted, takes stock through the stock writer, links the customer to the shop's clients, carries no commission and is never paid out; a "Phone" / "Facebook" … badge marks it in the order list. Flyway `V20261020_120000__manual_orders.sql`, `ManualOrderIntegrationTest`, e2e `manual-order.spec.ts`.
- Load errors with a retry for booking times, the store's reviews tab and the Create Business district list.

- Not found, error and empty states everywhere (`src/components/feedback`):
  - 404 pages inside each surface's frame (marketplace, Seller, Provider, admin console) via catch-all routes, plus a locale-level and a root fallback; unknown items (product, service, shop, order, booking, and admin shop / user / order) say what is missing.
  - Error boundaries per surface ("Try again" keeps the frame), a locale-level one and `global-error.tsx`; errors show the request reference for support.
  - Failed loads say so with a retry instead of an endless spinner, a blank page or a misleading "nothing here": marketplace and Seller workspace start-up, checkout totals, search, order and booking pages, the account tabs, admin lists and records, payouts.
  - Empty states for lists that showed nothing: Seller promotions, reviews, customers, stock changes, notifications, best sellers; Provider reviews, services, retail, team, notifications, top services, sales by staff; store tabs, deals, the marketplace inbox and home sections.
  - e2e `feedback.spec.ts`.

- Phase 7 (super-admin console) per `docs/api/phase7-admin.md`, end to end:
  - Staff roles (`ADMIN`, `SUPER_ADMIN`) and the console at `/admin`: overview (GMV, orders, commission, growth, work queues, 30-day chart, top shops), shops (ID check with the ID photo, verify / reject with a reason, suspend / reinstate), users (suspend, reinstate, sign out everywhere, staff roles), orders across all shops (support cancel before shipping, refund after delivery), review moderation (hide / restore with ratings recomputed), platform promo codes, shop payouts (released the day after delivery, less commission, later refunds taken back; recorded with the bank reference) and an append-only audit log.
  - Suspension takes effect at once: the JWT filter checks the session on every request; suspended accounts cannot sign in (`ACCOUNT_SUSPENDED`); suspended shops leave the marketplace and take no orders or bookings.
  - Shops: a banner when suspended or when the ID was rejected, "Send a new ID photo", a payouts card and VirtualBiz notifications; provider settings take a Bakong ID.
  - Flyway `V20261019_120000__platform_admin.sql`, local seed `V20261019_120100__seed_local_admin.sql` (`admin@virtualbiz.com`, `support@virtualbiz.com`); `AdminIntegrationTest`, e2e `admin.spec.ts`.

- Phase 6 (images and optional payout) per `docs/api/phase6-files-profiles.md`:
  - Image uploads: `POST /api/files` (JPEG / PNG / WebP checked by content, 8 MB, `UNSUPPORTED_FILE` 415, `FILE_TOO_LARGE` 413) and public `GET /api/files/{id}`, stored on local disk (`VBIZ_STORAGE_DIR`) behind a `FileStore` interface.
  - Accounts have a profile photo and a cover (`PATCH /api/me` `avatarUrl` / `coverUrl`), shown on My profile, the account sidebar, the header, the account menu and the profile switcher.
  - Businesses have a logo and a cover, set in Seller and Provider settings and shown in the workspace top bars, the profile switcher, shop cards, search and the store page (`MarketShop` / `MyBusiness` `logoUrl`).
  - Product photos are uploaded files instead of inline data URLs.
  - Create Business: "Get paid" is optional (**Skip for now**); `bakongId` may be empty, and the done screen and the register's KHQR screen say where to add one.
  - Flyway `V20261018_120000__files_profile_images.sql`; seed fix `V20261018_120100__seed_local_booking_log_order.sql`; e2e `photos.spec.ts`.

- Release prep: `backend/Dockerfile` (Spring Boot jar on a JRE, non-root), `frontend/Dockerfile` (Next.js standalone server, `API_URL` and `NEXT_PUBLIC_*` as build args), `infra/docker/compose.yml` (PostgreSQL + API + web with the demo data) and `docs/ops/deploy.md`.

- Phase 5 (Seller register, promotions, reviews, customers) per `docs/api/phase5-pos-promotions-reviews.md`, end to end:
  - Register: shifts (`SHIFT_ALREADY_OPEN`), cash in / out, closing count with the difference, counter sales (`R-` receipts, idempotent by the register's `clientRef` for the offline queue), per-line refunds with optional restock; `POS_SALE` / `POS_REFUND` are server-only stock reasons.
  - Promotions: the shop's CRUD and "End now" with Undo; checkout applies a shop's best automatic promotion (quote `autoPromo`), collections as CATEGORY targets.
  - Reviews: customers review products from delivered orders and services from completed bookings (`/api/me/reviews`), updating ratings and notifying the shop; the Seller replies through the API.
  - Customers: product shops' clients come from their orders (back-filled by the migration, linked on every order), with the delivery district.
  - Flyway `V20261017_120000__pos_promotions_reviews_crm.sql` and the local seed `V20261017_120100__seed_local_pos_promotions.sql` (Nita Gadget Store's promotions, a month of shifts and counter sales, today's open shift).
  - Frontend: the Seller register, promotions, reviews and customers, the customer's review sheet and review lists use the API; the Seller workspace follows the shop's live stream; e2e `pos.spec.ts`.

- Phase 4 (bookings and the Service Provider workspace) per `docs/api/phase4-bookings-provider.md`, end to end:
  - Customer: public availability (`GET /api/marketplace/items/{slug}/availability`) from staff shifts, opening hours, closures, buffers, blocks and minimum notice; online booking with "anyone available", reschedule (`replaces`) and cancel inside the free-cancellation window (`/api/me/bookings`); `SLOT_UNAVAILABLE`, `BOOKING_UNAVAILABLE`.
  - Provider: appointments (phone and walk-in bookings, edit / move, the prototype's status flow, 30-second server-side Undo), calendar blocks, clients (`DUPLICATE_CLIENT`), checkout sales with retail items through the stock writer (completes the appointment), team members with shifts, deals CRUD, review replies.
  - Booking inbox kinds for shops and customers and the `appointment` / `sale` / `block` live events.
  - Flyway `V20261016_120000__bookings_clients_sales.sql` and the local seed `V20261016_120100__seed_local_bookings.sql` (Glow Beauty Salon's clients, 28-day history and sales generated with the prototype's formulas, today's calendar, requests, blocks, closures, retail items, inbox; Kry Sonita's BK-02201 at Sambath Barber).
  - Frontend: the provider workspace reads and writes the API (no localStorage copy); the service page's times, the confirm page, booking detail, "My bookings" and the bell use the API; e2e `bookings.spec.ts`.
- Phase 3 (cart, checkout, orders, payments, notifications, live updates) per `docs/api/phase3-orders-checkout.md`: server cart with guest merge, checkout quote and idempotent checkout (one order per shop, promo codes, delivery zone fees), KHQR / card / COD payments with a local simulator, the customer's order tracking and cancel, the seller's order flow (accept with undo, reject, pack, ship, pickup, deliver, failed delivery, return), 1-hour auto-cancel, shop and customer inboxes, SSE live updates with stream tickets; seeded order history for Nita Gadget Store.

- Phase 2 (catalog, inventory, marketplace, saved items) per `docs/api/phase2-catalog-inventory.md`, end to end:
  - Marketplace reads (public): districts and categories, shops, items (products with variants and live stock, services with staff), reviews, deals, platform promo codes, and server-side search (text with `pg_trgm`, type, category, price, rating, on sale, open now, low delivery fee; best / price / rating / nearest sorts by point or district).
  - Seller catalogue: products with options and variants (price, compare-at, cost, SKU, barcode with per-shop `885000000xxx` auto numbers), collections, status, duplicate, soft delete.
  - Inventory: one server-side stock writer (`inventory.service.StockWriter`, enforced by ArchUnit) for opening stock, adjustments, quick ±1 merging and undo; movement log and low / out-of-stock alerts.
  - Provider services CRUD with staff assignment; business members list.
  - Saved items and followed shops (`/api/me/saved`).
  - Flyway `V20261014_130000__catalog_inventory_marketplace.sql` and the local seed `V20261014_130100__seed_local_catalog.sql` (every marketplace shop's listings, staff, specs, deals, reviews; Nita Gadget's stock history adds up to its stock).
  - Frontend: the marketplace, search, saved items, seller products / inventory and provider services read and write the API; seller orders / POS write stock through the API writer; e2e for product edit + stock undo on the customer page, API search, saved items, provider services.
- Backend Phase 1 (auth, account, business) per `docs/api/phase1-auth-account-business.md`:
  - Auth: email + password with lockout (5 tries → 30 s), sign-up with email verification, email-code login, password reset, phone SMS sign-in and registration, Google ID-token sign-in (`NOT_CONFIGURED` until `VBIZ_GOOGLE_CLIENT_ID`), a local/dev Google stand-in, refresh-token rotation with reuse detection, log out and log out everywhere.
  - Account: `/api/me`, preferences, password change, addresses with default rules.
  - Business: create (OWNER membership, unique slug, ID photo), my businesses, get, patch settings; `X-Business-Id` tenancy filter.
  - Spring Security (stateless JWT), springdoc OpenAPI at `/api/docs`, `NOT_CONFIGURED` status code.
  - Flyway `V20261014_120000__auth_account_business.sql` and the local-only demo seed `db/seed-local/V20261014_120100__seed_local_demo.sql`.
  - Unit tests and MockMvc integration tests against the `vbiz_test` database.

### Changed

- The Seller's settings page saves to the API (`PATCH /api/businesses/{id}`): online, auto-accept, prep time, low-stock default, pickup, COD, delivery fees, free-delivery threshold, KHQR merchant id and the shop details were only kept in the browser before.
- Adding to the cart while the account's server cart is still loading no longer loses the item (the change is merged into the server cart instead of being overwritten).
- A deal may have an empty description (the form allows it; the API refused it).

- An online booking or order only links the customer's account to a shop client found by phone when that phone is the account's own (typing someone else's number no longer takes over their client record).

- `lib/mock` is gone: Create Business's category chips are the onboarding feature's own config (`features/business-onboarding/categories.ts`), the default delivery zones moved to `lib/pricing/zones.ts`, and there is no "demo business" seeding any more (shop store v6, seller store v4).
- The register no longer sells past the counted stock ("only N left"); the API refuses negative stock.
- The shop code of Nita's Water Festival promotion is `NITAWATER` (`WATERFEST` is the platform's code).

- Removed the provider mocks (`lib/mock/provider.ts`, `provider-history.ts`) and the customer's local bookings (shop store v5); the remaining mock repo only holds the seller's POS, customers, promotions and reviews (Phase 5).
- `AppointmentStatus` follows the Service Provider prototype: an arrived client can be checked out, cancelled or marked no-show, and a no-show can be undone.

- Removed the marketplace, listing, user and stock-movement mocks (`lib/mock/marketplace.ts`, `shop-listing.ts`, `users.ts`, the seller collections and stock log); the remaining mock repo only holds records whose APIs come in Phases 3–5.
- The customer store no longer keeps saved items or a client-side `sold` stock adjustment (persisted v3); the seller and provider workspace stores re-seed once (v2) because products, variants, services and staff now have API ids.
- Local defaults: PostgreSQL on port 5433, API on port 8180.

### Earlier

- Initial project structure.
