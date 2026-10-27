# FRD 2026-10-27-v02 — Unified Multi-Industry Business Management Platform

| Item | Value |
|---|---|
| Requested by | Product owner |
| Screen ID(s) | New: unified workspace (launcher, organisation switcher), platform console, module screens per FRD. Existing: WeGroupware apps, VirtualBiz surfaces |
| Status | **Agreed (core)** — owner chose option A on 2026-10-27: WeGroupware is the platform core ("WePlatform"), VirtualBiz is one app in it ([ADR-0002](../adr/0002-virtualbiz-is-an-app-in-weplatform.md)). Phase 1 is specified in WeGroupware FRD `2026-10-27-v01-weplatform-sso-and-app-registry` |

## Background

The owner wants one platform that manages many businesses and industries, sold as SaaS to outside
organisations **and** used by the owner's own group. Two systems exist today:

- **WeGroupware** (`Kosign/wehr`, Spring Boot `com.webcash.wgpp` + Next.js, PostgreSQL): six apps —
  **Board, Calendar (CAL), Approval (AP), HR Management, System (SYS), My Profile (MY)** — already
  multi-tenant.
- **VirtualBiz** (this repo, Spring Boot `com.kosign.vbiz` + Next.js, PostgreSQL): marketplace,
  seller (orders, POS, inventory) and service-provider (bookings) workspaces, KHQR payments.

Rule from the owner: **reuse and integrate the existing apps; do not rewrite one without a verified
technical reason.** The parent platform name is not decided; products keep their own names
(VirtualBiz stays a separately identifiable product).

## Owner's answers (2026-10-27)

| # | Question | Answer |
|---|---|---|
| 1 | Customers | **Both**: the owner's group and outside organisations (multi-tenant SaaS) — own users, roles, permissions, data; branches and departments; modules switched on per organisation; strict isolation; central administration for the group |
| 2 | "Bank" | **Payments and payouts through licensed partners** — not a bank. Provider-agnostic payment layer: collection, transaction records, reconciliation, payouts; auditable; Cambodian licensing checked before launch |
| 3 | "Company" | **General Business Management** as modular capabilities sharing one data model: companies and branches, CRM, HR, payroll and attendance, accounting / finance / expenses / invoices, documents and approval workflows, projects and tasks, reports and dashboards |
| 4 | Existing or new | **Both**: the six WeGroupware apps are reused; new modules come step by step — Education, Retail & Commerce, Service & Operations, more finance / payment integrations |
| 5 | Name | **New parent platform name (TBD)**; VirtualBiz is a product under it; no forced shared prefix |
| 6 | Deployment | **One shared platform architecture**, modular backend, common identity / authorization / API standards; web and backend deploy independently; existing apps stay independently deployable during migration; sensitive parts (payments) separated where justified; dev / test / staging / production; **no service per module without a clear reason** |

## What exists (inspected 2026-10-27, read-only)

| Platform need | WeGroupware today | VirtualBiz today |
|---|---|---|
| Organisation (tenant) | `TenantGroup` = a family of companies, co-owners (ADR-0003/0004) | none (each shop is a `business`) |
| Companies / branches | `companies` in a family, head office, new company cloned from it (ADR-0004) | `business` (PRODUCT / SERVICE) with members Owner / Manager / Staff |
| Departments | department tree, tenant-shaped (ADR-0005) | — |
| Modules per organisation | `tenant_app_entitlements` (app, status, seat limit, expiry) + launcher (MY-0180) + `CompanyAppEnforcementInterceptor` | — |
| Product per company | `CompanyProduct` (GROUPWARE, WE_ATTENDANCE) + `ProductEnforcementInterceptor` | — |
| Central administration | Super Admin (whole group), Company Admin, per-app administrators (`AppCode`) | super-admin console (platform staff) |
| Data isolation | automatic `company_code` filter (aspect) + `@PreAuthorize` | per-business checks in services |
| Identity | login ID or email + password, optional email code; RSA JWT; **one company per person** (ADR-0004) | consumers and merchants: email / Google (Firebase) / code / phone; two-step sign-in; JWT |
| Approvals | self-built workflow engine (forms, lines, routing rules) | — |
| Notifications | inbox + SSE + email + web push | inbox + SSE + email + Firebase push, per-topic choices |
| Payments | — | KHQR (Bakong) payments, payouts, commission, simulator |
| Languages | en / ko / kh | en / kh |

## Requirements

### A. Platform core (shared by every product)
1. One identity per person with single sign-on across products (web and mobile); MFA available everywhere and required for money and admin roles.
2. Organisation → companies / branches → departments; members with roles per organisation and per module.
3. Module catalogue and per-organisation entitlements (on / off, plan, seats, expiry); a unified workspace with launcher and organisation switcher.
4. Data isolation enforced on the server for every module, with tests that prove one organisation cannot read another's data.
5. Central administration for the owner's group plus self-service for outside organisations (sign-up, verification, billing).
6. Shared services: notifications (inbox, email, push, SSE, per-topic choices), files, audit log, approval workflows, reporting.
7. Common API standards (envelope, error codes, pagination, i18n of errors), environments dev / test / staging / production.

### B. Products and modules
8. **WeGroupware apps** (Board, Calendar, Approval, HR, System, My Profile) keep working and stay deployable on their own during migration.
9. **VirtualBiz** becomes the Retail & Commerce product: a VirtualBiz shop or salon belongs to an organisation's company / branch; its public marketplace stays public; its consumer customers are not organisation members.
10. **General Business Management** modules (CRM, payroll and attendance, accounting / finance / invoices, documents, projects and tasks, dashboards) are built on the shared data model (one customer, one employee, one company) — HR from WeGroupware, commerce customers and sales from VirtualBiz.
11. **Education** and **Service & Operations** are new modules, each with its own FRD.

### C. Payments (partner-based)
12. A payment integration layer with provider adapters (Bakong KHQR first — VirtualBiz's existing code — then banks / card acquirers), behind one internal API: collect, record, reconcile, pay out, refund.
13. Every movement in an append-only ledger; reconciliation reports; audit trail; secrets and keys isolated.
14. Deployed as its own service only if partner, security or licensing requirements call for it (decided per partner); licensing confirmed before any live money flows.

## Decision (owner, 2026-10-27: **A**)

**Which system is the platform core?**

| Option | What it means | Risk |
|---|---|---|
| **A. WeGroupware is the core (recommended)** | Its tenants, companies, departments, entitlements, launcher, admin roles, approvals and notifications become the platform. VirtualBiz connects to it: single sign-on, its businesses map to tenant companies, it appears in the launcher as an app. New modules are added to the WeGroupware backend as domains. | Two codebases to align (package names, Java 17 vs 21, auth). Its "one company per person" rule (ADR-0004) must be relaxed for SaaS members who work for several organisations. |
| B. VirtualBiz is the core | Rebuild tenants, departments, entitlements, approvals in VirtualBiz, then move WeGroupware apps over. | Rewrites working, deployed apps — against the owner's rule. |
| C. New core service | Extract identity / tenancy into a new service both use. | Most work, most moving parts before any user benefit. |

Recommendation: **A**, because the tenancy, entitlement and admin model the owner asked for already
runs in production there, and "do not rewrite" rules out B and C for now.

## Proposed phases (after the decision)

| Phase | Outcome |
|---|---|
| 0 | ADR for the core + product hierarchy; shared API and auth standards; parent name placeholder |
| 1 | **Single sign-on**: platform identity issues tokens both systems accept (OIDC-style, JWKS); VirtualBiz merchant staff sign in with their platform account; consumers keep VirtualBiz sign-in |
| 2 | **VirtualBiz as an app**: app code + entitlement; VirtualBiz business ↔ tenant company / branch; launcher tile; organisation switcher covers both |
| 3 | **Payment layer**: VirtualBiz's KHQR code becomes the first adapter behind a provider-agnostic API |
| 4+ | General Business Management modules (CRM, accounting / invoices, payroll, projects), then Education and Service & Operations — one FRD each |

## Out of scope (this FRD)

- Functional design of each new module (own FRD each).
- Renaming existing products or packages.
- Live money movement before partner contracts and licensing are confirmed.

## Open questions

1. ~~Confirm the core~~ — **A**, 2026-10-27.
2. Where do platform-level documents and ADRs live — the WeGroupware repo, this repo, or a new platform repo?
3. Can a person be a member of several organisations (needed for SaaS), changing WeGroupware's "one company per person" rule?
4. Is Korean (ko) required for VirtualBiz and the new modules, or only en / kh?
5. Which payment partner(s) first, besides Bakong KHQR?
6. Parent platform name (placeholder until decided).

## Acceptance criteria (Phases 1–2)

- [ ] A merchant signs in once and opens both a WeGroupware app and VirtualBiz without signing in again.
- [ ] An organisation switches VirtualBiz on or off in the platform; its members see or lose the launcher tile and the API refuses VirtualBiz calls when off.
- [ ] A VirtualBiz shop is linked to a company / branch of its organisation; data of one organisation is never visible to another (tested).
- [ ] Both systems keep their existing tests green and stay deployable on their own.
- [ ] All new screens in the agreed languages, phone and desktop.
