# API Phase 6: image uploads, profile and shop photos, optional payout

Adds image uploads and puts them to use: a profile photo and cover for every account, a logo
and cover for every business, and product photos stored as files instead of inline data URLs.
It also makes the Create Business "Get paid" step optional. It builds on Phases 1–5: same base
path, `ApiResponse` envelope, `StatusCode` names and bearer token.

## Files (`com.kosign.vbiz.storage`)

```text
UploadedFile = {id, url ("/api/files/{id}"), purpose, contentType, size}
purpose      = AVATAR | USER_COVER | BUSINESS_LOGO | BUSINESS_COVER | PRODUCT_PHOTO
```

| Method & path | Who | Body | Returns |
|---|---|---|---|
| POST `/api/files` | signed in | multipart `file` + `purpose` | **201** `UploadedFile` |
| GET `/api/files/{id}` | public | | the image bytes (not the JSON envelope), `Cache-Control: public, max-age=31536000, immutable`; **404** when unknown |

- Only JPEG, PNG and WebP, checked by the file's first bytes rather than its name or the browser's
  type: anything else is **415** `UNSUPPORTED_FILE`.
- At most `vbiz.storage.max-bytes` (8 MB): **413** `FILE_TOO_LARGE`. The multipart limits (9 MB
  file, 10 MB request) only sit above it.
- A file belongs to the account that uploaded it. A URL saved as a profile photo or cover or a
  shop logo or cover must be the caller's own upload with a matching purpose, otherwise **400**
  `VALIDATION_FAILED` with the field (`avatarUrl`, `coverUrl`, `logoUrl`).
- A file's id never points to other content, so browsers and proxies may cache it for good.
  Replaced photos stay on disk (no clean-up job yet).
- Storage is the local disk (`vbiz.storage.dir`, env `VBIZ_STORAGE_DIR`, default
  `./data/uploads`) behind the `FileStore` interface, so an S3 / MinIO store can replace it.

## Profile photos (`PATCH /api/me`)

`User` and `Me` gain `coverUrl?` next to `avatarUrl?`. `PATCH /api/me` accepts both:

| Field | Value |
|---|---|
| `avatarUrl` | an `AVATAR` upload's URL; `""` removes the photo |
| `coverUrl` | a `USER_COVER` upload's URL; `""` removes the cover |

Absent fields are unchanged. A removed photo is absent from the answer (fields that are `null` are
left out).

## Shop photos (`PATCH /api/businesses/{id}`)

`logoUrl` (a `BUSINESS_LOGO` upload) and `coverUrl` (a `BUSINESS_COVER` upload); `""` removes
either. They appear on `Business`, on `MarketShop` (`logoUrl?`, `coverUrl?`, after `about`) and
on `MyBusiness` (`logoUrl?`, for the profile switcher). Without them the customer screens keep
the tinted category placeholder.

## Product photos

`photos[]` on a product also accepts `/api/files/{id}` URLs; the Seller's product editor now
uploads each photo as `PRODUCT_PHOTO` and saves that URL. Image URLs and data URLs from before
this phase are still accepted, so existing products keep their photos (product photo URLs are
checked by shape only, not by owner).

## Optional payout

- `CreateBusinessRequest.bakongId` is optional: absent or blank creates the business without one.
  When given it must still look like `name@bank` (`VALIDATION_FAILED`, `field: "bakongId"`).
- `Business.bakongId` may be `null`; `PATCH /api/businesses/{id}` with `bakongId: ""` clears it.
- The ID photo was already optional. Payouts start once a Bakong ID is set and the ID is checked.

Frontend: the wizard's step 3 marks both fields optional and has **Skip for now**. Without a
Bakong ID, the done screen says payouts are off until one is added in Settings, and the register's
KHQR screen asks for one.

## Database

Flyway `V20261018_120000__files_profile_images.sql`: table `stored_file` (owner, purpose, type,
size, storage key), `users.cover_url`, and `business.bakong_id` made nullable.
