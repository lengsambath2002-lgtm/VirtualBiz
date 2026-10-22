# API Phase 2: catalog, inventory, marketplace, saved items

The contract between `backend/vbiz-api` and `frontend` for the customer marketplace (read), the seller's products and stock, the provider's services, and the customer's saved items and followed shops. It builds on [Phase 1](./phase1-auth-account-business.md): same base path, `ApiResponse` envelope, error codes (`StatusCode` names the client translates), access token and `X-Business-Id` tenancy.

Out of scope here (later phases): carts, orders and the order/POS stock movements they cause (Phase 3/4), bookings (Phase 4/5), writing reviews and merchant replies (Phase 5), seller promotions and provider deals CRUD.

## Conventions

- **Ids** are UUID strings. Listings (products, services) and shops also have a **slug**, unique across the platform, which the customer URLs use: `/p/{productSlug}`, `/s/{serviceSlug}`, `/shop/{businessSlug}`. Every public endpoint that takes `{slug}` also accepts the id. A product slug and a service slug never collide (one listing namespace), so a saved-item key like `latte` is unambiguous.
- **Money** is a JSON number in USD with at most 2 decimals (`NUMERIC(12,2)`); riel is derived by the client's money helpers.
- **Variant options** are an object `{optionName: value}` whose key order follows `product.options`.
- **Times** are ISO-8601 UTC instants. "Open now" is evaluated in `Asia/Phnom_Penh`.
- **Merchant endpoints** (`/api/catalog/**`, `/api/inventory/**`) need the bearer token and `X-Business-Id`; without the header they answer `BUSINESS_CONTEXT_REQUIRED`, for a non-member `FORBIDDEN_TENANT`. Reads are open to every member; writes to products, collections and services need OWNER or MANAGER (`FORBIDDEN` for STAFF). Stock movements are open to every member (staff run the counter).

## Reference data (`com.kosign.vbiz.meta`, public)

| Method & path | Returns |
|---|---|
| GET `/api/meta/districts` | `District[]` = `{id, name, km, lat, lng}` in display order (`lat`/`lng` = the district's centre) |
| GET `/api/meta/categories?type=PRODUCT\|SERVICE&marketplace=true` | `Category[]` = `{id, name, icon, tint, businessType, inMarketplace}`; `marketplace=true` keeps the 8 marketplace categories |

## Marketplace (`com.kosign.vbiz.marketplace`, public, GET only)

A shop is listed when it is `online`, not `REJECTED`, and has at least one listing. A product is listed when `ACTIVE`; a service when `bookableOnline`. Deleted listings never appear.

| Method & path | Query | Returns |
|---|---|---|
| GET `/api/marketplace/shops` | `lat, lng` or `district` (optional, for `distanceKm`) | `MarketShop[]` (nearest first when a location is given, else by name) |
| GET `/api/marketplace/shops/{slug}` | same | `MarketShop` (any business by slug or id, listed or not). `BUSINESS_NOT_FOUND` |
| GET `/api/marketplace/shops/{slug}/reviews` | | `ListingReview[]` of all the shop's listings, newest first |
| GET `/api/marketplace/items` | `shop` (slug), `type=product\|service` | `MarketItem[]` in shop order (shop, then position) |
| GET `/api/marketplace/items/{slug}` | | `MarketItem`. `LISTING_NOT_FOUND` |
| GET `/api/marketplace/items/{slug}/reviews` | | `ListingReview[]`, newest first |
| GET `/api/marketplace/search` | see below | `SearchResult` |
| GET `/api/marketplace/deals` | | `MarketDeal[]` running now (`startsAt ≤ now ≤ endsAt`), ending soonest first |
| GET `/api/marketplace/promotions` | | `Promotion[]`: platform-wide codes running now |

### Search

`GET /api/marketplace/search?q=&type=&category=&min=&max=&rating=&sale=&open=&freeDel=&sort=&lat=&lng=&district=`

| Param | Meaning |
|---|---|
| `q` | Case-insensitive substring of the listing name or description, the shop name, or the shop's category id / name (trigram-indexed `ILIKE`) |
| `type` | `all` (default), `product`, `service`, `shop` (items are still returned; the client shows shops) |
| `category` | Comma-separated category ids (the shop's category) |
| `min`, `max` | Net unit price bounds in USD (the price of the default variant after the discount) |
| `rating` | Minimum listing rating (shops: minimum shop rating) |
| `sale=1` | Discounted listings only |
| `open=1` | Shops open now (Phnom Penh time) |
| `freeDel=1` | Products whose shop's zone fee to `district` is at most $0.75 |
| `sort` | `best` (default: sold × rating), `low`, `high` (net price), `rating`, `near` (shop distance) |
| `lat`, `lng` | The customer's point (exact location or district centre) for distance |
| `district` | The customer's district (name or id): zone fee for `freeDel`, and the distance origin when `lat`/`lng` are absent |

`SearchResult` = `{items: MarketItem[], shops: MarketShop[], itemTotal, shopTotal, page, size}`: one page (`page` from 0, `size` 1–60, default 24) of each list, and how many match in all. Explore loads the next page as the customer scrolls near the end (a "Show more" button does the same), shows a failed page with a retry, and says when everything is shown. `items` honour every filter and `sort`; `shops` honour `q`, `category`, `open`, `rating` and `type` (product / service) and are always nearest first. Distance is the haversine km from the origin to the shop's pin (min 0.1, one decimal); a shop without a pin falls back to the district `km` difference. Unknown `type`/`sort` values are ignored (defaults).

### Shapes

```text
MarketShop  = {id, slug, type: PRODUCT|SERVICE, name, categoryId, icon, tint, about, phone,
               district, street, lat?, lng?, hours[7], closures[], rating, reviewCount, since,
               replyMinutes?, etaMinutes?: [min, max], openNow, distanceKm?,
               staff: [{id, name, title?, color?}],      // members assigned to a listed service
               productSettings? | bookingSettings?}       // as Phase 1, by type
MarketItem  = MarketProduct | MarketService (by `type`)
MarketProduct = {type: "PRODUCT", id, slug, businessId, shopSlug, title, description, categoryId,
               options: [{name, values[]}], variants: [{id, productId, options{}, price, compareAt?,
               sku, stock, swatch?}], photos[], specs: {label: value}, sold, rating}
MarketService = {type: "SERVICE", id, slug, businessId, shopSlug, name, category, description,
               durationMin, price, discountPct?, staffIds[], sold, rating}
ListingReview = {id, businessId, targetId, itemSlug, authorName, stars, text, tags[], variantName?,
               verified, reply?, at}
MarketDeal  = {id, businessId, shopSlug, title, body, discountPct?, serviceIds[], startsAt, endsAt}
Promotion   = {id, businessId: null, name, type, value, code, scope, targetIds[], minSpend?,
               maxDiscount?, startsAt, endsAt, uses, usageLimit?}
```

Variant `stock` is the live server count; customers never see `cost` or `barcode`. Variants are in matrix order (the first variant has every option's first value).

## Seller catalog (`com.kosign.vbiz.catalog`, merchant)

| Method & path | Body | Returns |
|---|---|---|
| GET `/api/catalog/products` | | `SellerProduct[]` (every status, newest first) |
| GET `/api/catalog/products/{id}` | | `SellerProduct`. `PRODUCT_NOT_FOUND` |
| POST `/api/catalog/products` | `ProductInput` | **201** `SellerProduct`. Each variant's `stock` becomes an `OPENING_STOCK` movement |
| PUT `/api/catalog/products/{id}` | `ProductInput` | `SellerProduct`. Variants are matched by `id`: kept ones keep their stock (their `stock` field is ignored), new ones open with `stock` (`OPENING_STOCK`, note `newVariant`), missing ones are removed |
| PATCH `/api/catalog/products/{id}/status` | `{status: ACTIVE\|DRAFT}` | `SellerProduct` |
| POST `/api/catalog/products/{id}/duplicate` | | **201** `SellerProduct`: "`{title} (copy)`", `DRAFT`, stock 0, empty SKUs, new barcodes |
| DELETE `/api/catalog/products/{id}` | | empty (soft delete; the movement log keeps its rows) |
| GET `/api/catalog/collections` | | `Collection[]` = `{id?, name, productCount}`; a shop without collections gets the defaults Phones, Audio, Wearables, Laptops, Accessories (no `id` until used) |

```text
ProductInput  = {title, description?, collection?: name, status, lowStockAt, options: [{name, values[]}],
                 variants: [{id?, options{}, price, compareAt?, cost?, sku?, barcode?, swatch?, stock?}],
                 photos?: string[], specs?: {label: value}}
SellerProduct = {id, slug, businessId, title, description, categoryId, collection?, status, options,
                 variants: [{id, productId, options{}, price, compareAt?, cost?, sku, barcode, stock,
                 swatch?}], photos[], specs{}, lowStockAt, sold, rating, createdAt, updatedAt}
```

Rules (prototype editor): title 2–80; description ≤ 1000; up to 3 options, names unique (case-insensitive), values unique and non-empty; the variants are exactly the option matrix (one variant with `{}` when there are no options), at most 100; `price > 0`; `compareAt > price` when set; `cost ≥ 0`; `stock` 0–1,000,000; `lowStockAt` 0–100,000; `sku` ≤ 40 and unique in the shop when not empty (`DUPLICATE_SKU`, `field: "variants[i].sku"`); `barcode` ≤ 40, unique in the shop (`DUPLICATE_BARCODE`); an empty barcode gets the shop's next `885000000xxx` number. `collection` is a name: an unknown one is created. The slug is made from the title on create (`-2`, `-3`, … on collision) and never changes. `categoryId` is the shop's category. Up to 8 photos (URLs or `data:image/*` URLs ≤ 7 MB each; placeholder until the storage domain).

## Inventory (`com.kosign.vbiz.inventory`, merchant)

Every stock change in the system goes through **one writer** (`inventory.service.StockWriter`): it locks the variant row, applies the delta, refuses a negative result and appends the movement in the same transaction. Product creation (opening stock), these endpoints and — from Phase 3/4 — orders and the POS all call it.

| Method & path | Body / query | Returns |
|---|---|---|
| GET `/api/inventory/movements` | `variantId?`, `productId?`, `limit` (default 100, max 500) | `StockMovement[]`, newest first |
| POST `/api/inventory/movements` | `{variantId, delta, reason, note?, mergeQuick?, system?}` | **201** `StockWriteResult` |
| DELETE `/api/inventory/movements/{id}` | | `{variant: VariantStock}` — undo: reverses the delta and drops the row |
| GET `/api/inventory/alerts` | `state=LOW\|OUT` (optional) | `StockAlert[]`: variants of ACTIVE products at or below the product's `lowStockAt` |

```text
StockMovement    = {id, variantId, productId, delta, reason, byUserId?, byName?, note?, at}
StockWriteResult = {movement: StockMovement, variant: VariantStock, merged: boolean}
VariantStock     = {id, productId, stock}
StockAlert       = {productId, productTitle, variantId, variantName, sku, stock, lowStockAt, state: LOW|OUT}
```

- `delta` is a non-zero integer; the result must stay ≥ 0, else `INSUFFICIENT_STOCK` (409, `meta.stock` = current count).
- `reason` (`StockReason`): `RECEIVED`, `COUNT_CORRECTION`, `DAMAGED_LOST`, `CUSTOMER_RETURN`, `QUICK_ADJUST`, `MARKED_SOLD_OUT`, and — until the order and POS domains exist — `POS_SALE`, `POS_REFUND`, `ORDER_CANCELLED` sent by the seller workspace's local order/POS screens. `OPENING_STOCK` (product editor) and `ORDER_SALE` (Phase 3 checkout) are server-only: `VALIDATION_FAILED` (`field: "reason"`).
- `mergeQuick: true` with `QUICK_ADJUST`: when the shop's latest movement is a `QUICK_ADJUST` of the same variant by the same user less than 60 s ago, the delta is added to that row (`merged: true`, same id) — the prototype's ±1 taps.
- `system: true` (only with `ORDER_CANCELLED`) records the movement as automatic (`byUserId`/`byName` null; the UI shows "System").
- `note` ≤ 120 characters. Unknown variant (or another shop's) → `VARIANT_NOT_FOUND`; unknown movement → `MOVEMENT_NOT_FOUND`; undo that would make stock negative → `INSUFFICIENT_STOCK`.

## Provider services (`com.kosign.vbiz.catalog`, merchant, SERVICE businesses)

| Method & path | Body | Returns |
|---|---|---|
| GET `/api/catalog/services` | | `ProviderService[]` (including hidden, in position order) |
| POST `/api/catalog/services` | `ServiceInput` | **201** `ProviderService` |
| PATCH `/api/catalog/services/{id}` | partial `ServiceInput` (absent = unchanged; `discountPct: 0` clears) | `ProviderService` |
| DELETE `/api/catalog/services/{id}` | | empty (soft delete) |
| GET `/api/businesses/{id}/members` | (member) | `BusinessMember[]` = `{id, businessId, userId?, name, role, title?, color?, shifts[7]?, active}` — the staff list the calendar and service form use |

```text
ServiceInput    = {name, category, description?, durationMin, price, discountPct?, staffIds[], bookableOnline}
ProviderService = {id, slug, businessId, name, category, description, durationMin, price, discountPct?,
                   staffIds[], bookableOnline, sold, rating}
```

Rules: name 2–60, unique in the shop (case-insensitive; `CONFLICT`, `field: "name"`); category 1–40 (free text, e.g. Hair / Nails / Make-up); description ≤ 500; `durationMin` 5–600 in steps of 5; `price > 0`; `discountPct` 0–90 (0 = none); at least one staff member, each an active member of the shop (`MEMBER_NOT_FOUND`, `field: "staffIds"`). A PRODUCT business gets `WRONG_BUSINESS_TYPE` (409).

## Saved items and followed shops (`com.kosign.vbiz.account`, signed in)

The client's keys stay as they were: a listing slug (`latte`, `massage`) or `shop:` + a shop slug (`shop:happy-coffee`).

| Method & path | Returns |
|---|---|
| GET `/api/me/saved` | `SavedEntry[]` = `{key, type: PRODUCT\|SERVICE\|SHOP, id, savedAt}`, newest first |
| PUT `/api/me/saved/{key}` | `SavedEntry[]` (idempotent) |
| DELETE `/api/me/saved/{key}` | `SavedEntry[]` (idempotent) |

An unknown key → `LISTING_NOT_FOUND` (or `BUSINESS_NOT_FOUND` for `shop:`). At most 500 entries (`VALIDATION_FAILED`). Entries whose listing was deleted are dropped from the list.

## New status codes

| Code | HTTP | When |
|---|---|---|
| `LISTING_NOT_FOUND` | 404 | No product or service with that slug / id is listed |
| `MOVEMENT_NOT_FOUND` | 404 | Unknown stock movement (or another shop's) |
| `COLLECTION_NOT_FOUND` | 404 | Reserved for collection ids |
| `INSUFFICIENT_STOCK` | 409 | A movement would make stock negative (`meta.stock`) |
| `DUPLICATE_SKU` | 409 | SKU already used in the shop (`field`) |
| `DUPLICATE_BARCODE` | 409 | Barcode already used in the shop (`field`) |
| `WRONG_BUSINESS_TYPE` | 409 | Service endpoints called for a product shop |

## Implementation notes (backend, as built)

- **Tables** (`V20261014_130000__catalog_inventory_marketplace.sql`): `collection`, `product`, `product_variant` (`option_values` JSONB array aligned with `product.options`, `stock CHECK ≥ 0`, partial unique indexes on `(business_id, barcode)` and `(business_id, lower(sku))` for live rows), `catalog_barcode_seq`, `service`, `service_staff`, `stock_movement`, `promotion`, `deal`, `review`, `saved_listing`, and the read view `marketplace_listing` (products with their default-variant net price, services with the discounted price) that search filters with SQL. `pg_trgm` GIN indexes on product title/description, service name/description and business name back `q`. `district` gained `lat`/`lng`; `business` gained `reply_minutes`, `eta_min`, `eta_max` (marketplace display: "Replies in ~10 min", delivery ETA).
- **Stock writer:** `ProductVariant` has no stock setter; `adjustStock` is called only by `StockWriter` (enforced by `ArchitectureTest`). The variant row is read `FOR UPDATE`, so concurrent writers serialise. Undo (`DELETE`) also goes through the writer.
- **Soft deletes:** products, variants and services carry `deleted_at`; the SKU / barcode uniqueness and slugs ignore deleted rows, and the movement log keeps rows of deleted variants.
- **Shop display:** `icon` and `tint` come from the shop's category; `staff` lists active members assigned to at least one listed service; `rating` / `reviewCount` are the stored business values.
- **Search** runs the text, category, price, rating and sale filters in SQL over `marketplace_listing`; open-now, the zone-fee filter, distances and sorting run in the service (the shop count is small). Ties keep the shop and position order.
- **Seed (local and test profiles, `V20261014_130100__seed_local_catalog.sql`):** every marketplace shop's products, variants, services, staff, specs, deals, platform codes and listing reviews from the prototype mocks, with the mock ids as slugs (`latte`, `iphone`, `massage`, `glow-cut`, `nita-iphone15`, …). Nita Gadget Store has its 8 products (5 collections) with barcodes `885000000101`–`…118` and a movement history whose sum equals each variant's stock (`RECEIVED`, a damaged case, sold-out variants received then sold); every other variant opens with one `OPENING_STOCK` movement. Glow Beauty Salon has its 8 services and 3 staff (Try Dana, Srey Leak, Vicheka Sok) with colours and shifts; the marketplace service shops have their named staff.
