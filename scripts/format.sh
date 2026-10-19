#!/usr/bin/env bash
# Run every formatter, linter and type check. Must pass before commit.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

(cd "$ROOT/frontend" && pnpm format && pnpm lint && pnpm typecheck)
(cd "$ROOT/backend" && ./gradlew spotlessApply check)
