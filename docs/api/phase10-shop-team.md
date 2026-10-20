# API Phase 10: shop teams

A shop is run by more than its owner. Each person signs in with their own account, so every
order, sale and stock change is theirs, and access can be taken away without sharing passwords.

## Roles and permissions

| Role | Can | Can't |
|---|---|---|
| `OWNER` (one, the creator) | Everything: settings, payout account (Bakong ID), roles, removing anyone | Be removed or demoted |
| `MANAGER` | Products, prices, stock, orders, POS, promotions, bookings, customers, shop settings; invite staff, edit or remove staff | Change the payout account, set roles, invite or remove managers |
| `STAFF` | Day-to-day work: orders, the register, bookings, customers | Change settings, catalog writes, the team |

Enforced by the backend (`WorkspaceAccess.manager()` for catalog writes, `BusinessService.update`
for settings, owner-only `bakongId`, `updateMember` and `TeamService` for the team). The web
workspaces hide what a role can't do (`useMyRole`): staff see settings read-only and no invite
button; only the owner can edit the payout account.

## Team (signed-in member of the business)

| Method & path | Body | Returns |
|---|---|---|
| GET `/api/businesses/{id}/members` | | members, each with `email` when they have a login |
| PATCH `/api/businesses/{id}/members/{memberId}` | any of `{name, title, color, shifts, active, role}` | the member. `role` (MANAGER / STAFF) owner only; a manager changes staff only; nobody deactivates the owner or themself |
| GET `/api/businesses/{id}/invites` | | open invites (owner, manager) |
| POST `/api/businesses/{id}/invites` | `{email, name?, role, memberId?}` | **201** invite. Owner invites MANAGER or STAFF, manager STAFF only. `memberId` gives an existing member without a login (a stylist on the calendar) this person's account. **409** when already on the team |
| DELETE `/api/businesses/{id}/invites/{inviteId}` | | open invites |

Removing access is `active: false`: the person can't open the workspace any more
(`FORBIDDEN_TENANT`), and their history stays. Restoring is `active: true`.

## Joining (public)

| Method & path | Body | Returns |
|---|---|---|
| GET `/api/join/{token}` | | `{businessId, businessName, businessType, logoUrl, email, name, role, invitedBy, expiresAt, accountExists, accountHasPassword}`; **404** `INVITE_NOT_FOUND`, **410** `INVITE_EXPIRED` |
| POST `/api/join/{token}/accept` | `{name?, password}` | `AuthSession` + refresh cookie |

- The link is `{VBIZ_APP_URL}/en/join/{token}`: single use, valid `vbiz.team.invite-ttl` (7 days),
  only its SHA-256 stored; the page is `noindex`, `no-referrer`.
- An existing account confirms its password (login lockout applies); a new one is created with the
  customer password rules. The member joins (or is re-activated, or the linked member gets the
  login) and the shop's workspace opens.
- Email goes through `TeamMailer` (logging stand-in until a provider is configured). With
  `vbiz.team.expose-dev-links` (local, test) the API returns `devLink` and the workspace shows it.

## Database

Flyway `V20261020_150000__business_team.sql`: table `business_invite` (one open invite per email
per business).
