# VirtualBiz

> A local marketplace for Phnom Penh: shop, book and pay with KHQR. Businesses sell online and at the counter (Seller + POS) or take bookings (Service Provider), all from one account.

## At a glance

| Area | Technology |
|---|---|
| Frontend | Next.js (App Router) · React · TypeScript · Tailwind · TanStack Query · next-intl |
| Backend | Spring Boot · Java · Gradle (`vbiz-api` + `vbiz-common`) · JPA/Hibernate |
| Database | PostgreSQL 15+ · Flyway |
| Storage | MinIO (S3-compatible) |
| Mobile | iOS (Swift / SwiftUI) and Android (Kotlin / Jetpack Compose) |
| i18n | `en` (default) · `kh` |
| Payments | KHQR / Bakong · card · cash (USD + KHR) |
| CI/CD | GitLab CI |

## Repository layout

| Path | Contents |
|---|---|
| `frontend/` | Next.js web app |
| `backend/` | Spring Boot API (`vbiz-api`) and shared infrastructure (`vbiz-common`) |
| `mobile/` | Native iOS and Android apps |
| `db/` | Seed data and DB scripts |
| `infra/` | Docker, k8s and Terraform |
| `docs/` | ADRs, FRDs, PRDs, API/DB/ops docs |
| `tests/` | Cross-stack E2E, contract and load tests |
| `scripts/` | Developer scripts (`format.sh`, …) |

The prototype is described in [docs/prd/prototype-inventory.md](./docs/prd/prototype-inventory.md). For the full map, see [ARCHITECTURE.md](./ARCHITECTURE.md). For working rules, see [AGENTS.md](./AGENTS.md) and [CONTRIBUTING.md](./CONTRIBUTING.md).

## Setup

**Prerequisites:** Docker, JDK 17+, Node 22, pnpm 10.

pnpm is the package manager for this repo. Don't use npm or yarn.

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
./scripts/format.sh        # format + lint + typecheck + backend check
```

### Docker

`docker compose -f infra/docker/compose.yml up --build` runs PostgreSQL, the API and the web app
with the demo data on http://localhost:3000. Deploying the images (configuration, migrations,
scaling, what still needs credentials): [docs/ops/deploy.md](./docs/ops/deploy.md).

### Backend (API)

PostgreSQL 15+ on **127.0.0.1:5433** (database / user / password `vbiz`). Integration tests use a separate `vbiz_test` database, which they wipe and re-migrate:

```bash
psql -h 127.0.0.1 -p 5433 -d postgres -c "create database vbiz_test owner vbiz"   # once
cd backend
SPRING_PROFILES_ACTIVE=local ./gradlew bootRun   # API on http://localhost:8180
./gradlew test                                   # unit + integration tests
```

- The `local` profile runs Flyway on start-up, including the demo seed (`db/seed-local`): sign in as `nita@virtualbiz.com` / `Demo@1234`.
- In `local` and `dev` every code-sending endpoint returns the code as `data.devCode` (there is no SMS / email gateway yet).
- API docs: Swagger UI at http://localhost:8180/api/docs, OpenAPI at `/api/docs/openapi.json`. Contracts: [docs/api/phase1-auth-account-business.md](./docs/api/phase1-auth-account-business.md), [docs/api/phase2-catalog-inventory.md](./docs/api/phase2-catalog-inventory.md), [docs/api/phase3-orders-checkout.md](./docs/api/phase3-orders-checkout.md), [docs/api/phase4-bookings-provider.md](./docs/api/phase4-bookings-provider.md), [docs/api/phase5-pos-promotions-reviews.md](./docs/api/phase5-pos-promotions-reviews.md), [docs/api/phase6-files-profiles.md](./docs/api/phase6-files-profiles.md), [docs/api/phase7-admin.md](./docs/api/phase7-admin.md).
- Outside `local`, `VBIZ_JWT_SECRET` (32+ bytes) is required. Google sign-in answers `NOT_CONFIGURED` until `VBIZ_GOOGLE_CLIENT_ID` is set.
