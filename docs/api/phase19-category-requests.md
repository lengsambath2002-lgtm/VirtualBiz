# API Phase 19: category suggestions

Shops organise their own catalogue freely (product collections, phase 12; service categories),
while the marketplace's categories stay curated by VirtualBiz, as on Shopify, Etsy or Grab. A shop
whose kind isn't listed suggests a category; platform staff decide.

## Shop side (`X-Business-Id`)

| Method & path | Who | |
|---|---|---|
| GET `/api/category-requests` | any member | the shop's suggestions, newest first |
| POST `/api/category-requests` | owner or manager | `{name (2–40), nameKh?, note? (≤ 300)}` → **201**. **CONFLICT** when the shop has one waiting, or the name is an existing category of its kind |
| DELETE `/api/category-requests/{id}` | owner or manager | withdraw a waiting one |

Settings → **Marketplace category** (both workspaces): pick any category of the shop's kind
(`PATCH /api/businesses/{id}` `categoryId`), or "Suggest a category"; the list shows each
suggestion's state and the decision note. Suggesting is in the shop activity log
(`CATEGORY_REQUESTED`).

## Console (`/api/admin/category-requests`)

- `GET ?status=PENDING|APPROVED|REJECTED|WITHDRAWN` (default PENDING, oldest first), paged.
- `POST /{id}/approve` (super-admin) `{categoryId?}` maps to an existing category of the same kind;
  without it a new category is made from `name` / `nameKh` / `icon` / `tint` (the suggestion's names
  by default) and audited as `CATEGORY_CREATED`. `moveShop` (default true) files the shop under it.
- `POST /{id}/reject` (super-admin) `{reason}` (3–300 characters).
- A second decision is **CONFLICT**. Decisions are audited (`CATEGORY_REQUEST_APPROVED` /
  `_REJECTED`, target the shop) and the shop gets `CATEGORY_APPROVED` / `CATEGORY_REJECTED` in its
  inbox, linking to its settings.

Settings → Categories shows the waiting suggestions above the category lists (other staff see the
queue; super-admins decide), and the overview has a "Category suggestions" queue card
(`queues.categoryRequests`).

Table `category_request` (`V20261022_120000__category_requests.sql`), one waiting suggestion per
shop (partial unique index).
