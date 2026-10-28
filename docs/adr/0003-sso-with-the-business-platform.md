# ADR-0003: Single sign-on with the Business Platform

- Status: Accepted, 2026-10-28
- Supersedes: the WeGroupware-specific parts of [ADR-0002](./0002-virtualbiz-is-a-module-of-the-business-platform.md)
  (decision B: WeGroupware as identity provider, `docs/platform/02-integration-contract.md`). ADR-0002's
  ownership split (VirtualBiz is the Retail & Commerce module; merchants use SSO, marketplace
  customers keep VirtualBiz's own sign-in; never link by email alone) still holds.
- Contract: business-platform repository, `docs/integrations/virtualbiz-sso.md` (final; both sides build to it)
- API: [docs/api/platform-sso.md](../api/platform-sso.md)

## Context

The identity provider is the new Business Platform (`apps/api`), not WeGroupware. It issues an
OpenID Connect-style authorization code with PKCE; VirtualBiz is a confidential client (id + secret,
fixed redirect URI). Shops can be linked to a platform organisation, and the organisation's members
should reach the shop with access that follows their role there.

## Decision

1. **Configuration.** `VBIZ_PLATFORM_URL` (the platform's web origin, also the token issuer),
   `VBIZ_PLATFORM_CLIENT_ID`, `VBIZ_PLATFORM_CLIENT_SECRET` (env only). Without all three the
   feature is off: `GET /api/auth/methods` says `platform: false`, the button is hidden, the
   endpoints answer `NOT_CONFIGURED`. The redirect URI is `{VBIZ_APP_URL}/platform/callback`, a web
   page, so the session is set up same-origin.
2. **Start.** The API makes `state`, `nonce` and an S256 PKCE verifier and keeps them in a hashed,
   single-use, 10-minute `auth_ticket` (`SSO_STATE`; the token is the state, the verifier is sealed
   with `VBIZ_DATA_KEY`, the nonce stored as a hash) with the intent (`signin`, `open` + shop,
   `connect` + organisation and/or shop) and a sanitised `next`.
   It also sets an httpOnly `vb_platform` cookie (`Path=/api/auth/platform`, 30 minutes) whose hash is on
   the ticket: a callback (or a link ticket) only finishes in the browser that started it, which
   stops login-CSRF and "link my identity to your account" tricks.
3. **Complete.** The callback page posts `code` + `state`. The API burns the state (even if what
   follows fails), exchanges the code at the token endpoint (HTTP Basic client auth, 5 s connect /
   10 s read timeouts) and verifies the ID token with nimbus-jose-jwt (already a dependency): RS256
   against the JWKS from discovery, cached by `kid` and fetched again for an unknown one, `iss` =
   `VBIZ_PLATFORM_URL`, `aud` = client id, `exp` with ≤ 60 s skew, `nonce`.
4. **Who.** `user_identity (provider, subject)` is the only key (`sub`, never email).
   Found → that account. Not found but an account has the same email → `LINK_REQUIRED`
   (`meta.ticket`, masked `meta.email`); the person signs in to that account the usual way and
   confirms (`POST /api/auth/platform/link`, signed in as exactly that account, same browser);
   only then is the identity stored. Otherwise a new account is made from `name` and `email`
   (the platform's `locale` is kept on the identity; `users` has no locale column).
   Sign-in then takes the normal path (`AuthService.signInFromPlatform`: suspension, two-step,
   sign-in method `PLATFORM`). A two-step challenge carries `meta.route` so the web app can finish
   where the sign-in was headed.
5. **Staff follow the platform** for shops linked to an organisation in the token: OWNER / ADMIN →
   MANAGER, MEMBER → STAFF, GUEST → none. Such rows are `business_member.platform_managed`, made or
   updated on every platform sign-in (and on link), deactivated when the person is no longer in
   the organisation, when the shop is disconnected or moved to another organisation. The shop's
   OWNER row, staff added by hand and staff who joined by invite are never touched; when an owner or
   manager changes a platform-managed member's role or access by hand, the row stops being
   platform-managed (the shop's decision wins). Each change is in the shop activity log with
   `via: PLATFORM`.
   The token's `orgs` alone never grants access to a shop (contract addendum, 2026-10-28): before
   granting or updating access, VirtualBiz asks the platform `GET …/links/{businessId}`. A 404 or
   another organisation → the shop is unlinked here as well (`platform_org_id` cleared, its
   platform-managed staff deactivated, `PLATFORM_DISCONNECTED` with `reason: UNLINKED_ON_PLATFORM`).
   No answer (network, 5xx) → fail closed: no new access to that shop in this sign-in, existing
   rows kept unchanged, a warning logged.
6. **Shop links.** `business.platform_org_id` (+ name, when, by whom). Only the shop's OWNER
   connects, and only to an organisation where their latest platform sign-in (≤ 10 minutes old,
   `vbiz.platform.connect-ttl`) shows OWNER or ADMIN; the platform's `PUT …/links/{businessId}`
   (Basic auth, `linkedBy` = their `sub`) checks again. Disconnect calls `DELETE` and clears it.
   Both are logged (`PLATFORM_CONNECTED` / `PLATFORM_DISCONNECTED`).

## Consequences

- New migration `V20261028_100000__platform_sso.sql`: `user_identity`, the business and member
  columns, `PLATFORM` sign-in method, `SSO_STATE` / `SSO_LINK` ticket kinds and `auth_ticket.data`.
- Web: "Continue with Business Platform" on sign-in and sign-up; pages `/platform/callback`,
  `/platform/open?business=`, `/platform/connect?org=`; a Business Platform panel in both
  workspaces' settings.
- Tests mock the platform (`PlatformClient`) and sign tokens with a local RSA key; a live run across
  both apps is a separate step.
