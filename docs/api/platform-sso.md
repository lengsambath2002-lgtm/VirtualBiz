# Sign-in with the Business Platform and shop links

Decision: [ADR-0003](../adr/0003-sso-with-the-business-platform.md). The platform side is in the
business-platform repository, `docs/integrations/virtualbiz-sso.md`. Off (`NOT_CONFIGURED`) until
`VBIZ_PLATFORM_URL`, `VBIZ_PLATFORM_CLIENT_ID` and `VBIZ_PLATFORM_CLIENT_SECRET` are set;
`GET /api/auth/methods` → `{phone, platform}`.

## Sign-in (`/api/auth/platform`)

| | Body | Answer |
| --- | --- | --- |
| `POST /start` | `{intent: signin\|open\|connect, businessId?, orgId?, next?}` (`open` needs `businessId`) | `{authorizeUrl}` and the `vb_platform` cookie. Send the browser to the URL |
| `POST /complete` | `{code, state}` (from `/platform/callback`; needs the cookie) | the usual session (`accessToken`, `expiresIn`, `user`, refresh cookie) plus `{intent, businessId?, orgId?, next?, orgs, business?}` |
| `POST /link` (signed in) | `{ticket}` (needs the cookie) | `{intent, businessId?, orgId?, next?, orgs, business?}`; the platform account is now linked |

`orgs`: `[{id, slug, name, role}]` from the ID token. `business`: `{id, name, type, role}` of the
shop asked for, when the person is an active member (after staff sync); absent otherwise.

`/complete` errors:

| Error | Meaning |
| --- | --- |
| `INVALID_TOKEN` | state unknown, used, expired or from another browser; code refused by the platform; ID token failed a check (signature, `iss`, `aud`, `exp`, `nonce`) |
| `LINK_REQUIRED` (409) | an account already has this email: `meta.ticket` (10 minutes), `meta.email` (masked), `meta.name`. Sign in to it, then `POST /link` |
| `TWO_STEP_REQUIRED` | as any sign-in (docs/api/two-step.md), plus `meta.route` (the object above) |
| `ACCOUNT_SUSPENDED` | |
| `PLATFORM_UNAVAILABLE` (502) | the platform could not be reached or answered unexpectedly |

`/link` errors: `INVALID_TOKEN`, `FORBIDDEN` (`meta.reason: WRONG_ACCOUNT` — signed in as an account
the ticket isn't for), `CONFLICT` (that platform account or this account is already linked to
another one).

## Shop link (`/api/businesses/{id}/platform`)

| | | |
| --- | --- | --- |
| `GET` | any member | `{available, linked, orgId?, orgName?, linkedAt?, canManage}` |
| `POST /connect` | `{orgId}`, owner | links (calls the platform's `PUT …/links/{id}`); same shape |
| `DELETE /connect` | owner | unlinks (platform `DELETE`); platform-managed staff lose access |

`POST /connect` errors: `NOT_CONFIGURED`, `PLATFORM_UNAVAILABLE`, `FORBIDDEN` with `meta.reason`
`NOT_OWNER`, `NOT_LINKED` (no platform sign-in on this account), `SIGN_IN_AGAIN` (the roles from the
last platform sign-in are more than 10 minutes old), `NOT_ORG_ADMIN`, `PLATFORM_FORBIDDEN`.

## Staff sync

On every platform sign-in (and on link), for shops linked to an organisation in the token:
OWNER / ADMIN → MANAGER, MEMBER → STAFF, GUEST → none, in `business_member` rows marked
`platform_managed`. Rows for shops whose organisation is no longer in the token are deactivated.
The owner row and staff added by hand or invite are never changed.

Before granting or updating access to a shop, the API confirms the link with the platform
(`GET {PLATFORM}/api/integrations/virtualbiz/links/{businessId}`, client Basic auth). 404 or a
different organisation: the shop is unlinked here too (its platform-managed staff lose access,
`PLATFORM_DISCONNECTED` with `details.reason = UNLINKED_ON_PLATFORM`). No answer: nothing new is
granted for that shop in this sign-in and existing rows stay as they are. Logged as `TEAM_JOINED`,
`TEAM_ROLE_CHANGED`, `TEAM_RESTORED`, `TEAM_REMOVED` with `details.via = PLATFORM`.
