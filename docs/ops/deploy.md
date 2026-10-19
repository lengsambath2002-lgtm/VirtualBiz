# Deploying VirtualBiz

Two images and a PostgreSQL 15+ database. The GitLab pipeline (`.gitlab-ci.yml`) hands the
build and deploy to the shared pipeline project; this page lists what those jobs need.

## Images

| Image | Build | Listens | Health |
|---|---|---|---|
| API | `docker build -t vbiz-api backend` | 8180 | `GET /actuator/health` (and `/api/health`) |
| Web | `docker build --build-arg API_URL=http://<api-host>:8180 -t vbiz-web frontend` | 3000 | `GET /en` |

Both run as a non-root user. The web image is Next.js's standalone server; it proxies `/api/*`
to `API_URL`, so the browser only ever talks to the web origin (the refresh cookie is
same-origin, no CORS). **`API_URL` and every `NEXT_PUBLIC_*` value are fixed at build time**:
build one web image per environment.

| Web build arg | Meaning |
|---|---|
| `API_URL` | Where the web server sends `/api/*` (the API service inside the cluster) |
| `NEXT_PUBLIC_APP_ENV` | `dev` / `uat` / `prod` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Empty = the dev Google chooser (only works against a `local`/`dev` API) |

`infra/docker/compose.yml` runs the whole stack on one machine with the demo data
(`docker compose -f infra/docker/compose.yml up --build`) for demos and QA.

## API configuration

Every value is an environment variable (`backend/.env.example`):

| Variable | Required | Notes |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | yes | `dev`, `uat` or `prod` (`local` = demo seed, dev codes, payment simulator: never in a real environment) |
| `DATABASE_URL`, `DATABASE_USERNAME`, `DATABASE_PASSWORD` | yes | JDBC URL to PostgreSQL 15+ with `pg_trgm` available |
| `VBIZ_JWT_SECRET` | yes | ≥ 32 bytes, e.g. `openssl rand -base64 48`; rotating it signs everyone out |
| `VBIZ_GOOGLE_CLIENT_ID` | for Google sign-in | Without it Google sign-in answers `NOT_CONFIGURED` |
| `VBIZ_KHQR_BAKONG_ID` | for KHQR | VirtualBiz's merchant Bakong account |
| `VBIZ_STORAGE_DIR` | no | Where uploaded images are written (image default `/app/data/uploads`). Mount a persistent volume here: photos live only on this disk |
| `VBIZ_VERSION`, `LOG_DIR`, `SERVER_PORT`, `DATABASE_POOL_SIZE` | no | defaults in `application.yml` |
| `JAVA_OPTS` | no | image default `-XX:MaxRAMPercentage=75` |

**Migrations.** The `prod` profile does not run Flyway at start-up: the deploy job applies
`backend/vbiz-api/src/main/resources/db/migration` (only that folder — `db/seed-local` is demo
data for `local` and tests) before the new API version starts. Migrations are additive; never
edit one that has been applied.

## The first super-admin

Staff have no sign-up: a super-admin gives the role to an existing account in the console. In a
new environment, create the first one by signing up normally, then (once) in the database:

```sql
UPDATE users SET platform_role = 'SUPER_ADMIN' WHERE email = 'you@company.com';
```

They then open `/admin` and manage everyone else from **Users → Staff role**. Every staff action
is in the audit log (`admin_audit`).

## Running more than one API instance

- **Live updates** (`notification.sse.StreamHub`) are in memory: an event reaches only the
  browsers connected to the instance that made it. Run **one** API instance, or put a shared
  bus (Postgres `LISTEN/NOTIFY` or Redis) behind `StreamHub` before scaling out. Browsers
  reconnect on their own, so a restart is harmless.
- **Order jobs** (auto-cancel, KHQR expiry) run on every instance each minute; each order and
  payment is locked while it changes, so two instances never cancel the same order twice.
- **Uploaded images** are on the instance's disk (`VBIZ_STORAGE_DIR`): give every instance the
  same shared volume, or switch the `FileStore` to object storage (S3 / MinIO), before scaling out.
- Stream tickets are kept in memory too: a ticket is used within seconds of being issued, by
  the same instance when the load balancer has sticky sessions (otherwise the browser retries).

## Not live until credentials exist

These answer with a clear error, or stay off, until the accounts are set up:

| Integration | Today | Needs |
|---|---|---|
| SMS (phone sign-in codes, booking reminders, receipts by SMS) | codes only show in `local` / `dev` (`devCode`) | an SMS gateway account |
| Google sign-in | `NOT_CONFIGURED` | `VBIZ_GOOGLE_CLIENT_ID` (+ the web build arg) |
| KHQR payments | the local simulator confirms transfers; elsewhere a KHQR stays pending until it expires | Bakong merchant credentials and the payment-confirmation callback |
| Card payments | the local simulator | an acquirer account |

## Before going live

- Put a rate limit on the public and write endpoints at the gateway (sign-in and code requests
  already lock out after 5 wrong tries; `POST /api/me/bookings`, `/api/checkout` and
  `/api/marketplace/**` have no per-client limit of their own).
- Serve both origins over HTTPS: the refresh cookie is `Secure` outside `local`.
- Back up the database (stock, orders and money live only there) and the `VBIZ_STORAGE_DIR` volume
  (uploaded photos).
