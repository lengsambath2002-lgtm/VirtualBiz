import SwiftUI
#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

/// One colour token as a light/dark pair of sRGB hex values, plus an opacity per appearance for
/// the translucent glass tokens. The values are plain integers so tests can check them without
/// rendering anything; `Color(pair)` is the face screens use, and it follows the appearance live.
public struct ColorPair: Sendable, Equatable {
    public let light: UInt32
    public let dark: UInt32
    public let lightOpacity: Double
    public let darkOpacity: Double

    public init(light: UInt32, dark: UInt32, lightOpacity: Double = 1, darkOpacity: Double = 1) {
        self.light = light
        self.dark = dark
        self.lightOpacity = lightOpacity
        self.darkOpacity = darkOpacity
    }

    /// The same value in both appearances.
    public init(_ both: UInt32, opacity: Double = 1) {
        self.init(light: both, dark: both, lightOpacity: opacity, darkOpacity: opacity)
    }

    public func hex(dark isDark: Bool) -> UInt32 { isDark ? dark : light }
    public func opacity(dark isDark: Bool) -> Double { isDark ? darkOpacity : lightOpacity }

    static func components(_ hex: UInt32) -> (red: Double, green: Double, blue: Double) {
        (Double((hex >> 16) & 0xFF) / 255, Double((hex >> 8) & 0xFF) / 255, Double(hex & 0xFF) / 255)
    }

    /// The colour for one appearance, not following the system.
    public func fixed(dark isDark: Bool) -> Color {
        let rgb = ColorPair.components(hex(dark: isDark))
        return Color(.sRGB, red: rgb.red, green: rgb.green, blue: rgb.blue, opacity: opacity(dark: isDark))
    }
}

public extension Color {
    /// A dynamic colour that switches with the light/dark appearance.
    init(_ pair: ColorPair) {
        #if canImport(UIKit)
        self.init(uiColor: UIColor { traits in
            let isDark = traits.userInterfaceStyle == .dark
            let rgb = ColorPair.components(pair.hex(dark: isDark))
            return UIColor(red: rgb.red, green: rgb.green, blue: rgb.blue, alpha: pair.opacity(dark: isDark))
        })
        #elseif canImport(AppKit)
        self.init(nsColor: NSColor(name: nil) { appearance in
            let isDark = appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
            let rgb = ColorPair.components(pair.hex(dark: isDark))
            return NSColor(srgbRed: rgb.red, green: rgb.green, blue: rgb.blue, alpha: pair.opacity(dark: isDark))
        })
        #endif
    }
}
