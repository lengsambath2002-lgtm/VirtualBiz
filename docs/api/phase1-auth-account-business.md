# API Phase 1: auth, account, business

The contract between `backend/vbiz-api` and `frontend` for sign-in, the user's account and their businesses. Every response uses the `ApiResponse` envelope `{status:{code,message}, data, common:{requestId, timestamp}, error:{type, details:[{field,message,meta}]}}`. Error codes are `StatusCode` names. The client translates them; it never shows `message`.

## Transport

- Base path `/api`. The browser calls it through Next's rewrite (`/api/:path*` → `http://localhost:8180/api/:path*`), so it is the same origin and cookies work with no CORS.
- **Access token:** a JWT (HS256, 15 min). It is returned in `data.accessToken` and sent as `Authorization: Bearer <token>`. The client keeps it in memory only.
- **Refresh token:** opaque and random, stored hashed in `user_session`.
  - It lives in an httpOnly cookie `vb_refresh` (`Path=/api/auth`, `SameSite=Lax`, `Secure` outside local, Max-Age 30 days).
  - It rotates on every refresh.
  - Reuse of a rotated token revokes the whole session family.
- **Business context:** merchant endpoints read the `X-Business-Id` header. The tenancy filter checks membership and returns `FORBIDDEN_TENANT` if the user isn't a member.
- **Codes in local / dev profiles:** there is no SMS or email gateway yet. Every endpoint that sends a code returns `data.devCode` (the 6 digits) when `vbiz.otp.expose-dev-code=true` (local and dev only). Production sends through `OtpSender` (SMS: Twilio-style interface; email: SMTP) and never exposes the code.

## Auth session payload (`AuthSession`)

```json
{ "accessToken": "…", "expiresIn": 900, "user": User }
```

`User` = `{ id, name, email?, phone?, avatarUrl?, signInMethods: ["PASSWORD"|"GOOGLE"|"EMAIL_CODE"|"PHONE_SMS"], createdAt }`.

## Auth endpoints (`com.kosign.vbiz.auth`)

| Method & path | Body | Returns | Errors |
|---|---|---|---|
| POST `/api/auth/lookup` | `{email}` | `{exists, methods[]}` | |
| POST `/api/auth/login` | `{email, password}` | `AuthSession` + cookie | `INVALID_CREDENTIALS` (unknown email → `meta.reason="NO_ACCOUNT"`; wrong password → `meta.reason="BAD_PASSWORD"`, `meta.triesLeft`); `ACCOUNT_LOCKED` (5 wrong tries → 30 s, `meta.retryAfter` in seconds) |
| POST `/api/auth/otp` | `{purpose:"VERIFY"\|"LOGIN"\|"RESET"\|"PHONE", to}` | `{expiresAt, resendAt, devCode?}` | `OTP_RESEND_TOO_SOON` (`meta.retryAfter`); LOGIN/RESET to an unknown email → `USER_NOT_FOUND` |
| POST `/api/auth/signup` | `{name, email, password}` | `{expiresAt, resendAt, devCode?}` (sends the VERIFY code; the pending signup is stored with the code) | `CONFLICT` (`field:"email"`, email taken); `VALIDATION_FAILED` (password rules: ≥8, upper+lower, digit, symbol, must not contain the email's name part) |
| POST `/api/auth/signup/verify` | `{email, code}` | `AuthSession` + cookie (user created, method PASSWORD) | `OTP_INVALID` (`meta.triesLeft`), `OTP_EXPIRED`, `OTP_ATTEMPTS_EXCEEDED` |
| POST `/api/auth/login/code` | `{email, code}` | `AuthSession` + cookie (adds EMAIL_CODE) | OTP errors |
| POST `/api/auth/password/reset/verify` | `{email, code}` | `{resetToken}` (10 min, single use) | OTP errors |
| POST `/api/auth/password/reset` | `{resetToken, password}` | `AuthSession` + cookie | `INVALID_TOKEN`, `VALIDATION_FAILED` |
| POST `/api/auth/phone/verify` | `{phone, code}` | `{status:"SIGNED_IN", session: AuthSession}` or `{status:"NEW", phoneToken}` | OTP errors, `INVALID_PHONE` |
| POST `/api/auth/phone/register` | `{phoneToken, name, email?}` | `AuthSession` + cookie (method PHONE_SMS) | `INVALID_TOKEN`, `CONFLICT` (email taken) |
| POST `/api/auth/google` | `{idToken}` | `AuthSession` + cookie (sign in or create; method GOOGLE) | `INVALID_TOKEN`; `NOT_CONFIGURED` when `vbiz.google.client-id` is unset |
| POST `/api/auth/google/dev` | `{email, name}` | `AuthSession` | local/dev only (stands in for Google until a client id exists) |
| POST `/api/auth/refresh` | (cookie) | `AuthSession` + rotated cookie | `REFRESH_TOKEN_INVALID` |
| POST `/api/auth/logout` | (cookie) | empty, clears cookie | |
| POST `/api/auth/logout-all` | (auth) | empty, revokes every session of the user | |

Phones are stored normalised as `0XXXXXXXX` (`PhoneNumbers`). Emails are stored lower-cased.

Code rules match the prototype:
- A code lasts 10 minutes.
- Resend is allowed after 30 s.
- 5 wrong codes kill the code.
- Codes are stored as SHA-256 hashes.

## Account endpoints (`com.kosign.vbiz.account`)

| Method & path | Body | Returns |
|---|---|---|
| GET `/api/me` | | `User` + `prefs:{deals, promos}` |
| PATCH `/api/me` | `{name?, phone?}` | `User` |
| PUT `/api/me/prefs` | `{deals, promos}` | prefs |
| POST `/api/me/password` | `{currentPassword, newPassword}` | empty. Errors: `INVALID_CREDENTIALS` (`field:"currentPassword"`), `VALIDATION_FAILED` |
| GET `/api/me/addresses` | | `Address[]` |
| POST `/api/me/addresses` | `{label, name, phone, line, district, note?, lat?, lng?, isDefault?}` | `Address` (the first address is always the default) |
| PUT `/api/me/addresses/{id}` | same | `Address` |
| POST `/api/me/addresses/{id}/default` | | `Address[]` |
| DELETE `/api/me/addresses/{id}` | | `Address[]` (if the default was deleted, the next one becomes default) |

`Address` = `{id, userId, label:"HOME"|"WORK"|"OTHER", name, phone, line, district, note?, lat?, lng?, isDefault}`.

## Business endpoints (`com.kosign.vbiz.business`)

| Method & path | Body | Returns |
|---|---|---|
| POST `/api/businesses` | `{type:"PRODUCT"\|"SERVICE", name, categoryId, district, street, lat?, lng?, phone, hours:{open:"HH:MM", close:"HH:MM", sunday:boolean}, bakongId, idPhoto?:dataUrl}` | `Business`. The creator becomes OWNER; verification is PENDING until review; product settings / booking settings get the documented defaults |
| GET `/api/me/businesses` | | `MyBusiness[]` = `{id, name, type, role:"OWNER"\|"MANAGER"\|"STAFF", verification}` |
| GET `/api/businesses/{id}` | (member, `X-Business-Id`) | `Business` |
| PATCH `/api/businesses/{id}` | (owner/manager) partial settings | `Business` |

`Business` follows `docs/db/domain-model.md`: `{id, ownerId, type, name, slug, categoryId, about?, phone, email?, district, street, lat?, lng?, hours[7], closures[], online, bakongId, verification, rating, reviewCount, since, productSettings? | bookingSettings?}`.

Slugs are unique (`name` slugified, with `-2`, `-3`, … appended on collision).

## Implementation notes (backend, as built)

These pin down details the tables above leave open. None of them changes a shape above.

- **Error `meta`** is in `error.details[0].meta` (with `field` beside it), e.g. `INVALID_CREDENTIALS` → `{field:"password", meta:{reason:"BAD_PASSWORD", triesLeft:3}}`; `OTP_INVALID` → `{field:"code", meta:{triesLeft}}`; `OTP_RESEND_TOO_SOON` / `ACCOUNT_LOCKED` → `meta.retryAfter` (whole seconds).
- **HTTP status** follows `StatusCode`: 401 for auth/OTP failures, 429 for `OTP_ATTEMPTS_EXCEEDED` / `OTP_RESEND_TOO_SOON`, 422 `VALIDATION_FAILED`, 409 `CONFLICT`, 403 `FORBIDDEN` / `FORBIDDEN_TENANT`, 503 `NOT_CONFIGURED`. `POST /api/businesses` and `POST /api/me/addresses` answer **201**; everything else 200.
- **Password rules** failures carry `meta.rules` = the failed keys (`len`, `case`, `num`, `sym`, `email`), matching `features/auth/util/rules.ts`.
- **Lockout:** the 5th wrong password itself answers `ACCOUNT_LOCKED` (`retryAfter: 30`); while locked even the right password is refused. Signing in by email code clears the lock.
- **Codes:** a new code supersedes the previous one. `POST /api/auth/otp` with `VERIFY` re-sends the code of a pending sign-up (same name and password); with no pending sign-up it answers `NOT_FOUND`, and `CONFLICT` if the email has since been registered. A code that hit 5 wrong tries keeps answering `OTP_ATTEMPTS_EXCEEDED`; a used, superseded or missing code answers `OTP_EXPIRED`.
- **Password reset** revokes every existing session of the user before signing in.
- **`phone/verify` → `SIGNED_IN`** also sets the `vb_refresh` cookie.
- **`google/dev`** answers `NOT_FOUND` unless `vbiz.auth.google-dev-enabled` (on in local/dev). It also sets the cookie. Both Google endpoints link to an existing account with the same email.
- **`refresh`** clears the cookie when it fails.
- **`X-Business-Id`:** checked by the tenancy filter on every authenticated request that sends it. `GET/PATCH /api/businesses/{id}` check membership of `{id}` even without the header; if the header is sent it must equal `{id}` (`FORBIDDEN_TENANT` otherwise). A STAFF member gets `FORBIDDEN` on PATCH.
- **`district`** (addresses, businesses) accepts the district name or id, case-insensitive, and is stored and returned as the name (`"Toul Kork"`); unknown → `DISTRICT_NOT_FOUND`.
- **`categoryId`** accepts a platform category id or a Create Business chip id (`cafe-food`→`cafe`, `phones-electronics`→`electronics`, `salon-barber`→`salon`, `spa-massage`→`spa`, `nails`→`beauty`); it must belong to the business type, else `CATEGORY_NOT_FOUND`. The platform id is returned.
- **Create Business:** `bakongId` must match `^[a-z0-9._-]+@[a-z]+$` (case-insensitive); `idPhoto` is a base64 data URL (png, jpeg, webp, heic or pdf, at most 8 MB). Defaults: product `{autoAccept:false, prepMinutes:20, lowStockDefault:5, pickup:true, cod:true, zones: the 3 default zones}` (no `freeDeliveryOver`); booking `{onlineBooking:true, autoConfirm:false, reminderHours:24, minNoticeHours:2, freeCancelHours:2, bufferMinutes:0}`. `online` starts true; `rating` 0.
- **PATCH `/api/businesses/{id}`** fields: `name, categoryId, about, phone, email, district, street, lat, lng, hours, closures, online, bakongId, logoUrl, coverUrl, productSettings, bookingSettings`; absent = unchanged, `""` clears `about` / `email` / `logoUrl` / `coverUrl`. `hours` is `hours[7]` or the create form `{open, close, sunday}`. `productSettings` / `bookingSettings` merge field by field (`freeDeliveryOver: null` removes the threshold); sending the other type's settings is `VALIDATION_FAILED`. The slug never changes.
- **PATCH `/api/me`:** `phone: ""` removes the phone (only when the account has an email).
- **POST `/api/me/password`:** an account without a password yet (Google / phone) may omit `currentPassword`; it gains `PASSWORD`.
- **Addresses:** `isDefault:false` on the current default is ignored (one address is always the default). The list is default first, then oldest first; deleting the default promotes the oldest remaining one.
- **Docs:** OpenAPI at `/api/docs/openapi.json`, Swagger UI at `/api/docs`.

## Seed data (local profile only: `db/seed-local`)

- The demo users from the prototypes, all with password `Demo@1234`: Kry Sonita `nita@virtualbiz.com` (owner of Nita Gadget Store), Dom `dom@virtualbiz.com`, Try Dana `hello@glowbeauty.com.kh` (owner of Glow Beauty Salon).
- The marketplace shops as businesses, so `GET /api/me/businesses` works for the demo owners.
- As built (`V20261014_120100__seed_local_demo.sql`, fixed UUIDs):
  - Kry Sonita, phone `0968189261`, methods PASSWORD + GOOGLE, two addresses (Home `#12, St. 516` Toul Kork, default; Work `Vattanac Tower, Floor 9` Daun Penh).
  - Dom Chheng, phone `012345678`, PASSWORD (a known phone for phone sign-in).
  - Try Dana, phone `093828130`, PASSWORD + PHONE_SMS.
  - Nita Gadget Store `22222222-2222-4222-8222-000000000001` (slug `nita-gadget`, PRODUCT, VERIFIED) and Glow Beauty Salon `…0002` (slug `glow-beauty`, SERVICE, VERIFIED).
  - The other 7 marketplace shops (slug = the mock id, e.g. `happy-coffee`), each owned by a placeholder account `<slug>@shops.virtualbiz.com` (password `Demo@1234`).

## Firebase sign-in and push tokens (docs/ops/firebase.md)

| Method | Path | Auth | Body | Result |
|---|---|---|---|---|
| POST | `/api/auth/firebase` | public | `{ idToken, name? }` | Session (as `/api/auth/login`). Errors: `INVALID_TOKEN`, `EMAIL_NOT_VERIFIED` (403, email + password account whose email isn't confirmed), `ACCOUNT_SUSPENDED`, `NOT_CONFIGURED` |
| POST | `/api/auth/firebase/migrate` | public | `{ email, password }` | `{}`. Checks the password VirtualBiz keeps and gives the Firebase login the same one. Errors as `/api/auth/login` (`INVALID_CREDENTIALS` with `reason`/`triesLeft`, `ACCOUNT_LOCKED`) |
| POST | `/api/me/push-tokens` | signed in | `{ token, platform? }` (`web` \| `android` \| `ios`) | `{}`. Registers this device; a token already registered moves to this account |
| DELETE | `/api/me/push-tokens` | signed in | `{ token }` | `{}`. Only the caller's own token is removed |
