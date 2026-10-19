# CLAUDE.md

Read these first:

1. [AGENTS.md](./AGENTS.md): ownership, prohibited actions, commit rules
2. [ARCHITECTURE.md](./ARCHITECTURE.md): directory map and layering
3. `docs/prd/prototype-inventory.md` + `prototype-open-questions.md`: what the prototype specifies, and what's still undecided
4. `docs/adr/`: recent decisions

## Conventions

- **Frontend:** pages under `src/app/[locale]/(<group>)/` only assemble features. Put the logic in `src/features/<surface>-<feature>/` (surface = `shop`, `seller`, `provider`, …) (`components/`, `hooks/`, `queries.ts`, `types.ts`, `util/`). Put shared UI in `src/components/` and shared clients in `src/lib/`.
- **Backend:** each domain gets `com.kosign.vbiz.<domain>` with `controller/service/repository/domain/payload/mapper/event`. Cross-cutting code goes in `vbiz-common`. Controllers must not call repositories directly.
- **i18n:** every user-facing string is a message key in both languages (en, kh).
- **DB:** add a new timestamped Flyway file. Never edit one that has been merged.
- Topic-specific rules go in `.claude/rules/<topic>.md`.
- **Money:** store USD as `NUMERIC(12,2)`. Show KHR alongside (1 USD ≈ 4,100, rounded to 100) using the shared money helpers only.
- **Stock:** online orders and POS change stock only through the `inventory` stock-movement writer.
