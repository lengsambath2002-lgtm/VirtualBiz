import SwiftUI
import VBizData
import VBizDesignSystem

@main
struct VirtualBizApp: App {
    /// Phase 1 runs on the mock repositories (the prototype's data). Swap in live ones here once
    /// VBizAPI has endpoints; nothing below the shell needs to change.
    @State private var environment = AppEnvironment.mock()

    var body: some Scene {
        WindowGroup {
            RootView(environment: environment)
                .tint(VBiz.Palette.primary)
        }
    }
}
