# AGENTS.md — Agent Working Guide

> These are the shared rules for every agent (Claude Code, Codex, …) and person working in this repo.
> Rules specific to Claude are in [CLAUDE.md](./CLAUDE.md). Rules for people are in [CONTRIBUTING.md](./CONTRIBUTING.md).

## 1. Directory Ownership

| Area | Owner | Notes |
|---|---|---|
| `frontend/src/app/[locale]/(marketing|auth|shop)/*` + `features/landing`, `auth-*`, `shop-*` | _TBD_ | Customer side |
| `frontend/src/app/[locale]/(onboarding|seller)/*` + `features/business-onboarding`, `seller-*` | _TBD_ | Seller + POS |
| `frontend/src/app/[locale]/(provider)/*` + `features/provider-*` | _TBD_ | Service Provider |
| `backend/vbiz-api/.../vbiz/<domain>/` | _TBD_ | Per domain |
| `frontend/src/components/*`, `frontend/src/lib/*` | **Shared** | MR needs agreement from both areas |
| `backend/vbiz-common/` | **Shared** | MR needs agreement from both areas |
| `db/`, `infra/`, `.gitlab-ci.yml` | **Shared** | An infra change needs an ADR |
| `mobile/ios/`, `mobile/android/` | _TBD_ | Android follows iOS |
| `docs/` | _TBD_ | |

Record any ownership change as an ADR.

## 2. Avoiding Conflicts

1. Don't edit the same file at the same time as someone else.
2. Agree on any new module or top-level directory first, in an ADR or an issue.
3. Name migrations by timestamp, for example `V20261009_120000__init.sql`.
4. Resolve conflicts by rebasing. Don't create merge commits.

## 3. Format · Lint (before every commit)

| Command | Target |
|---|---|
| `pnpm format` / `pnpm lint` / `pnpm typecheck` | frontend |
| `./gradlew spotlessApply` / `./gradlew check` | backend |

`scripts/format.sh` runs all of them.

## 4. Prohibited

- Force pushes, `--no-verify`, and direct pushes to `main`
- Committing `.env`, `*.pem`, `*.key` or `secrets.*`
- Adding GPL- or AGPL-licensed dependencies
- Editing a migration after it has been merged

## 5. Commits · MRs

- Use Conventional Commits, for example `feat(auth): login API` or `fix(company): missing validation`.
- Each MR has one intent, and every item in `.gitlab/merge_request_templates/default.md` is filled in.
- Each MR needs at least one reviewer's approval.

## 6. New requests

Each development request or bug report goes in `docs/FRD/`. Copy `docs/FRD/_TEMPLATE.md` to start.
