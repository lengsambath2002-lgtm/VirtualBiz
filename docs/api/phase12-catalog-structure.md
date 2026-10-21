# API Phase 12: catalog structure

How a shop groups what it sells is the owner's, not a fixed list in code.

## Product collections (product shops; owner or manager to change)

| Method & path | Body | Returns |
|---|---|---|
| GET `/api/catalog/collections` | | `[{id, name, productCount}]` in display order. A shop's first look stores starters for its category |
| POST `/api/catalog/collections` | `{name}` | the list (**201**); **409** for a name taken (case-insensitive) |
| PATCH `/api/catalog/collections/{id}` | `{name}` | the list |
| DELETE `/api/catalog/collections/{id}` | `?moveTo={id}` | the list; its products move to `moveTo`, or to no collection |
| PUT `/api/catalog/collections/order` | every collection id, in order | the list |

Starters (`CatalogStarters`) by platform category: electronics (Phones, Audio, Wearables, Laptops,
Accessories), fashion (Women, Men, Kids, Shoes, Accessories), cafe (Coffee, Tea, Food,
Desserts), grocery (Fresh, Pantry, Drinks, Household), beauty-products (Skincare, Make-up, Hair
care, Fragrance); none otherwise. The product editor still picks a collection by name (a new name
creates it).

## Service categories (service providers)

`bookingSettings.serviceCategories`: the ordered list (up to 20, 1–40 characters, unique
ignoring case), changed with `PATCH /api/businesses/{id}`. When unset, `GET` returns starters for
the category: salon / beauty (Hair, Nails, Make-up), spa (Massage, Facial, Body), repair (Phones,
Laptops, Other repairs), fitness (Classes, Personal training), else Services.

- Saving a service in a category the list lacks adds it at the end.
- `POST /api/catalog/services/categories/rename` `{from, to}`: every service in `from` moves to
  `to` (merging when `to` exists); returns the list.
- Services also take a `description` (up to 500 characters) in the form.

The workspace lists categories in the owner's order, then any category a service uses that isn't
listed, so nothing disappears.
