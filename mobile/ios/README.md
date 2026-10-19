# VirtualBiz — iOS

| | |
|---|---|
| Platform | iOS **17.0**+ · iPhone · portrait |
| Language | Swift 6 language mode, strict concurrency · SwiftUI · Observation |
| Project file | **Generated** by XcodeGen from `project.yml` — never edit or commit `VirtualBiz.xcodeproj` |
| Bundle id | `com.kosign.virtualbiz` |
| Languages | en + km (Khmer; the product calls it `kh`, Apple's code is `km`) — `VirtualBiz/Resources/Localizable.xcstrings` |
| Outside dependencies | none |

## Setup

```sh
brew install xcodegen          # once
cd mobile/ios
xcodegen generate              # writes VirtualBiz.xcodeproj (git-ignored)
open VirtualBiz.xcodeproj      # or:
xcodebuild -scheme VirtualBiz -destination 'generic/platform=iOS Simulator' build
```

Package tests run without Xcode or a simulator:

```sh
cd mobile/ios/Packages/VirtualBizKit && swift test   # with full Xcode selected
mobile/ios/Tools/test-package.sh                     # works with Command Line Tools only, too
```

## Layout

```
VirtualBiz/                    app target
  VirtualBizApp.swift          @main; builds AppEnvironment (mock repositories for now)
  Shell/                       RootView (tab bar placeholder), AppEnvironment
  Platform/                    keychain, camera, connectivity (later)
  Features/<Feature>/          one folder per screen group (empty until Phase 2)
  Resources/                   Localizable.xcstrings
Packages/VirtualBizKit/
  VBizDomain                   models + enums from docs/db/domain-model.md, Money, PhoneNumber,
                               delivery fee, pricing/promos, order + appointment state machines
  VBizData                     repository protocols + Mock* actors over Resources/Mock/*.json
  VBizAPI                      APIClient protocol, Endpoint, APIEnvelope (mirrors vbiz-common ApiResponse)
  VBizDesignSystem             Liquid Glass tokens (light/dark) + PrimaryButton, AccentButton, Chip,
                               GlassCard, PriceLabel, Logo
```

Layering is enforced by package target dependencies: `VBizDomain` imports nothing;
`VBizDesignSystem` knows nothing about the domain (the app adapts `Money` to `PriceLabel`).

## Conventions

- Models are `Codable, Sendable, Hashable` structs; enum cases are camelCase with UPPER_SNAKE raw values.
- View models are `@MainActor @Observable final class`; repositories are `Sendable` (mocks are actors).
- Money is USD `Decimal`; KHR only ever comes from `Money.khr` (`round(usd × 4100 / 100) × 100`).
- Colours, radii, spacing and type come from `VBiz.*` tokens — no literals in screens.
- Mock JSON was ported from the prototype artifacts; the clock is fixed at 2026-10-09 12:30 Phnom Penh
  (`MockData.referenceNow`).
- Design-system previews use `PreviewProvider` (the `#Preview` macro needs Xcode's plugin, which breaks
  `swift build` on a Command Line Tools-only machine). The app target may use `#Preview`.
