# Contributing

## Branches

- `main`: the integration branch, protected. Nobody pushes to it directly.
- `uat` / `prod`: deployment branches. Pushing to them triggers `.gitlab-ci.yml`.
- Name working branches `feat/<scope>-<desc>`, `fix/<scope>-<desc>` or `chore/<desc>`.

## Workflow

1. `git pull --rebase` on `main`, then branch.
2. Make one change with one intent, and add tests for it.
3. Run `./scripts/format.sh`.
4. Open an MR using the template, and link the FRD or issue.
5. Get one approval, then rebase-merge.

## Adding things

| Adding | Where |
|---|---|
| A web screen | `frontend/src/app/[locale]/(group)/…/page.tsx` + `frontend/src/features/<feature>/` |
| An API | `backend/vbiz-api/.../vbiz/<domain>/controller` (+ service, repository, payload) |
| A table change | New `V<YYYYMMDD>_<HHMMSS>__<desc>.sql` in `backend/vbiz-api/src/main/resources/db/migration/` |
| An environment variable | `.env.example` + `docs/ops/` |
| A decision | `docs/adr/NNNN-<title>.md` |
