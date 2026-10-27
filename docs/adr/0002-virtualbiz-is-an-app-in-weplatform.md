# ADR-0002: VirtualBiz is one app in WePlatform

- Status: Accepted (owner, 2026-10-27)
- Date: 2026-10-27
- Related: [FRD — Unified Multi-Industry Business Management Platform](../FRD/Design%20a%20Unified%20Multi-Industry%20Business%20Management%20Platform.md), WeGroupware FRD `2026-10-27-v01-weplatform-sso-and-app-registry` and its ADR-0010

## Context

The owner wants one multi-tenant SaaS platform for many industries (general business management,
education, retail & commerce, service & operations, partner-based payments), used by the owner's
group and sold to outside organisations. WeGroupware (`kosign/wehr`) already runs the tenancy the
platform needs: tenant families of companies, departments, per-tenant app entitlements with a
launcher, Super / Company Admin and per-app administrators, approvals and notifications. The owner
ruled: reuse existing apps; no rewrite without a verified technical reason.

## Decision

1. **WeGroupware is the platform core ("WePlatform"; final name to be decided).** Organisations,
   companies / branches, departments, entitlements, platform administration and platform identity
   live there.
2. **VirtualBiz is the Retail & Commerce app in WePlatform**, a separately named product. It does
   not build its own organisation, department, entitlement or platform-admin model.
3. VirtualBiz stays its own deployable (web on Vercel, API on Render today), with its own database
   and domains (catalogue, orders, bookings, POS, inventory, marketplace).
4. **Two kinds of people use VirtualBiz:**
   - *Merchants and their staff* are WePlatform members. They sign in through WePlatform single
     sign-on; their VirtualBiz account is linked to the platform user.
   - *Marketplace customers* are the public, not organisation members. They keep VirtualBiz's own
     sign-in (email, Google, codes, two-step).
5. **Single sign-on** uses an OIDC-shaped authorization-code flow with PKCE issued by WePlatform:
   VirtualBiz is a registered client (client id, secret, allowed redirect URIs); it exchanges the
   one-time code server-to-server and verifies the signed identity token against WePlatform's
   published keys (JWKS). Details in the WeGroupware FRD.
6. **Account linking is never by email alone.** A platform identity links to an existing VirtualBiz
   account only after that account proves itself (signs in once to confirm), so a matching email
   on another system cannot take over an account.
7. Later phases (separate FRDs): a VirtualBiz business belongs to a company / branch of its tenant;
   VirtualBiz gets an app code and entitlement (switched on per organisation, refused by the API
   when off); payments move behind a provider-agnostic layer with KHQR as the first adapter.

## Consequences

- No tenancy / org / admin work in this repo; VirtualBiz's super-admin console keeps only
  marketplace operations (shops, orders, payouts, reviews, categories, content).
- New VirtualBiz columns: the linked platform user (and, in phase 2, tenant and company codes).
- Both systems keep their tests green and deploy independently during the migration.
- Supersedes nothing; ADR-0001 still holds for this repo's layout.
