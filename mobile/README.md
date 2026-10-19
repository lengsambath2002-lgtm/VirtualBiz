# VirtualBiz — mobile

Native clients (ARCHITECTURE.md §5). **iOS leads; Android follows it** in structure and behaviour.

| Folder | What | Status |
|---|---|---|
| [`ios/`](ios/README.md) | Swift 6 / SwiftUI app + the `VirtualBizKit` package | Phase 1: Domain, DesignSystem, mock Data, placeholder shell |
| `android/` | Kotlin app, `core/{api,data,domain,designsystem}` + `feature/` | Skeleton only |

Both mirror the canonical domain model in [`docs/db/domain-model.md`](../docs/db/domain-model.md) and the
open-question resolutions in [`docs/prd/prototype-open-questions.md`](../docs/prd/prototype-open-questions.md).
Every user-facing string ships in English and Khmer.
