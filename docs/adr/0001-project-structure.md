# ADR-0001: Project structure follows WeHR (WGPP)

- Status: Accepted
- Date: 2026-10-09

## Context

VirtualBiz starts empty. The team already runs WeHR (WGPP) and knows its layout, tooling and
review rules, so reusing that layout saves setup time and lets people move between the two.

## Decision

Use one repository holding:

- `frontend/`: one Next.js app (App Router). Each area is a route group under `src/app/[locale]/`, and the logic for each UI unit lives in `src/features/<feature>/`.
- `backend/`: Spring Boot with Gradle. `vbiz-api` is a single module with one package per domain (`com.kosign.vbiz.<domain>`), and `vbiz-common` holds shared infrastructure.
- `mobile/ios` (SwiftUI and the `VirtualBizKit` Swift package) and `mobile/android` (Compose with `core/*` modules).
- `db/`, `infra/`, `docs/`, `tests/`, `scripts/`.

Don't split this into a frontend monorepo or backend sub-modules unless a new ADR decides it.

## Consequences

- One PR can change the API and the UI together.
- Shared code (`frontend/src/components`, `frontend/src/lib` and `backend/vbiz-common`) needs a review from the owners of both areas.
