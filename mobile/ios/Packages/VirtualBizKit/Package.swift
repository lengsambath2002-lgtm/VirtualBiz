// swift-tools-version: 6.0
import PackageDescription

// The modular core of the VirtualBiz iOS client (ARCHITECTURE.md §5): Domain -> Data/API -> app.
//
// The layering is enforced HERE, by target dependencies, not by convention. VBizDomain declares
// no dependencies at all, so "Domain imports nothing" is a compile error rather than a review note.
// VBizDesignSystem knows nothing about the domain either: it takes plain values (Decimal, String).
//
// Swift 6 language mode (strict concurrency) from day one.
let package = Package(
    name: "VirtualBizKit",
    defaultLocalization: "en",
    // iOS is the product target. macOS is declared only so `swift build` / `swift test` run on
    // the dev Mac without an iOS destination. The package ships nothing for the Mac.
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "VBizDomain", targets: ["VBizDomain"]),
        .library(name: "VBizData", targets: ["VBizData"]),
        .library(name: "VBizAPI", targets: ["VBizAPI"]),
        .library(name: "VBizDesignSystem", targets: ["VBizDesignSystem"]),
    ],
    targets: [
        .target(name: "VBizDomain", swiftSettings: [.swiftLanguageMode(.v6)]),
        .target(
            name: "VBizData",
            dependencies: ["VBizDomain"],
            // Mock JSON ported from the prototype artifacts; decoded by `MockStore`.
            resources: [.copy("Resources/Mock")],
            swiftSettings: [.swiftLanguageMode(.v6)]
        ),
        // Hand-written for now: the APIClient protocol, Endpoint and the response envelope.
        // The generated OpenAPI client lands here once docs/api has a contract.
        .target(name: "VBizAPI", dependencies: ["VBizDomain"], swiftSettings: [.swiftLanguageMode(.v6)]),
        // Tokens and components only. No Domain dependency.
        .target(name: "VBizDesignSystem", swiftSettings: [.swiftLanguageMode(.v6)]),
        .testTarget(
            name: "VirtualBizKitTests",
            dependencies: ["VBizDomain", "VBizData", "VBizAPI", "VBizDesignSystem"],
            swiftSettings: [.swiftLanguageMode(.v6)]
        ),
    ]
)
