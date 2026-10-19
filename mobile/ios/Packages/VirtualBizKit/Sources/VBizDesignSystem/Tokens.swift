import SwiftUI

/// VirtualBiz design tokens, read from the prototypes' shared CSS: each page's `:root` palette
/// with the shared **Liquid Glass** layer (`<style id="glass">`) applied on top — the glass layer
/// overrides `--bg`, `--sunk`, `--line`, `--muted`, the dark `--surface` and the radii, so those
/// tokens take the glass values. Every colour is a light/dark pair.
///
/// Add a colour here, never as a literal in a screen.
public enum VBiz {

    // MARK: - Colour values

    public enum Swatch {
        // Ground
        /// `--bg` (glass): iOS grouped background / pure black.
        public static let background = ColorPair(light: 0xF2F2F7, dark: 0x000000)
        /// `--surface`; dark from the glass layer.
        public static let surface = ColorPair(light: 0xFFFFFF, dark: 0x1C1C1E)
        /// `--sunk` (glass): rgba(118,118,128,.12 / .24) — input wells, segmented tracks.
        public static let sunk = ColorPair(light: 0x767680, dark: 0x767680, lightOpacity: 0.12, darkOpacity: 0.24)
        /// `--line` (glass): rgba(60,60,67,.14) / rgba(84,84,88,.55).
        public static let line = ColorPair(light: 0x3C3C43, dark: 0x545458, lightOpacity: 0.14, darkOpacity: 0.55)
        /// `--line-h` (glass): the stronger hairline.
        public static let lineStrong = ColorPair(light: 0x3C3C43, dark: 0x787880, lightOpacity: 0.28, darkOpacity: 0.7)

        // Text
        /// `--ink`
        public static let ink = ColorPair(light: 0x141A2B, dark: 0xE9ECF3)
        /// `--ink-2`
        public static let inkSecondary = ColorPair(light: 0x2B3245, dark: 0xCDD2DE)
        /// `--muted` (glass)
        public static let muted = ColorPair(light: 0x6C6C78, dark: 0x98989F)

        // Brand
        /// `--primary`: navy in light, the yellow accent in dark.
        public static let primary = ColorPair(light: 0x1C2438, dark: 0xF5B800)
        /// `--on-primary`
        public static let onPrimary = ColorPair(light: 0xFFFFFF, dark: 0x141A2B)
        /// `--primary-hover`, used as the pressed state.
        public static let primaryPressed = ColorPair(light: 0x2A3552, dark: 0xFFC933)
        /// `--accent`: VirtualBiz yellow, the same in both appearances.
        public static let accent = ColorPair(0xF5B800)
        /// Text on the accent (the logo's "B"): always the light-mode ink.
        public static let onAccent = ColorPair(0x141A2B)
        /// `--accent-soft`
        public static let accentSoft = ColorPair(light: 0xFFF4CC, dark: 0x3A3010)
        /// `--accent-ink`
        public static let accentInk = ColorPair(light: 0x7A5B00, dark: 0xFFD45C)

        // Status
        public static let sale = ColorPair(light: 0xD93B3B, dark: 0xFF6B6B)
        public static let saleSoft = ColorPair(light: 0xFDECEC, dark: 0x3A1717)
        public static let ok = ColorPair(light: 0x1C8556, dark: 0x4CC98A)
        public static let okSoft = ColorPair(light: 0xE5F5EC, dark: 0x12301F)
        public static let info = ColorPair(light: 0x2F5BD3, dark: 0x86A6FF)
        public static let infoSoft = ColorPair(light: 0xEAF0FE, dark: 0x18233F)
        public static let focus = ColorPair(light: 0x3B6EF5, dark: 0x7FA2FF)

        // Glass material (`--g-fill`, `--g-fill-strong`, `--g-brd`)
        public static let glassFill = ColorPair(light: 0xFFFFFF, dark: 0x2C2C34, lightOpacity: 0.62, darkOpacity: 0.55)
        public static let glassFillStrong = ColorPair(light: 0xFFFFFF, dark: 0x2C2C34, lightOpacity: 0.82, darkOpacity: 0.78)
        public static let glassBorder = ColorPair(light: 0xFFFFFF, dark: 0xFFFFFF, lightOpacity: 0.75, darkOpacity: 0.14)
        /// The glass card's shadow tint (`--g-shadow`).
        public static let glassShadow = ColorPair(light: 0x141A2B, dark: 0x000000, lightOpacity: 0.08, darkOpacity: 0.45)

        /// Category tints `--t1…--t6`: (a) background, (b) stronger background, (i) ink.
        public struct Tint: Sendable, Equatable {
            public let background: ColorPair
            public let backgroundStrong: ColorPair
            public let ink: ColorPair
        }

        public static let tints: [Tint] = [
            Tint(background: ColorPair(light: 0xFFE7CF, dark: 0x3A2618), backgroundStrong: ColorPair(light: 0xFBD1A9, dark: 0x4A2F1B),
                 ink: ColorPair(light: 0x9A4B12, dark: 0xF2B17E)),
            Tint(background: ColorPair(light: 0xDCEAFD, dark: 0x172A44), backgroundStrong: ColorPair(light: 0xBDD5F8, dark: 0x1D3557),
                 ink: ColorPair(light: 0x1F4F95, dark: 0x8DB8F2)),
            Tint(background: ColorPair(light: 0xE3F3DF, dark: 0x1A2E1C), backgroundStrong: ColorPair(light: 0xC7E6BF, dark: 0x213B23),
                 ink: ColorPair(light: 0x2D6B2A, dark: 0x93D08E)),
            Tint(background: ColorPair(light: 0xFBE3F0, dark: 0x3A1A2D), backgroundStrong: ColorPair(light: 0xF3C6DE, dark: 0x4A2139),
                 ink: ColorPair(light: 0x8C2F66, dark: 0xEE9CCB)),
            Tint(background: ColorPair(light: 0xECE5FB, dark: 0x251C3D), backgroundStrong: ColorPair(light: 0xD6C9F6, dark: 0x2F244E),
                 ink: ColorPair(light: 0x5634A0, dark: 0xBFA8F5)),
            Tint(background: ColorPair(light: 0xFFF2C6, dark: 0x33290E), backgroundStrong: ColorPair(light: 0xFBE29A, dark: 0x433512),
                 ink: ColorPair(light: 0x7A5B00, dark: 0xFFD45C)),
        ]

        /// Tint slot 1–6 (a `Category.tint`); out-of-range values wrap.
        public static func tint(_ slot: Int) -> Tint {
            let index = ((slot - 1) % tints.count + tints.count) % tints.count
            return tints[index]
        }
    }

    // MARK: - Colour (what screens read)

    public enum Palette {
        public static let background = Color(Swatch.background)
        public static let surface = Color(Swatch.surface)
        public static let sunk = Color(Swatch.sunk)
        public static let line = Color(Swatch.line)
        public static let lineStrong = Color(Swatch.lineStrong)
        public static let ink = Color(Swatch.ink)
        public static let inkSecondary = Color(Swatch.inkSecondary)
        public static let muted = Color(Swatch.muted)
        public static let primary = Color(Swatch.primary)
        public static let onPrimary = Color(Swatch.onPrimary)
        public static let primaryPressed = Color(Swatch.primaryPressed)
        public static let accent = Color(Swatch.accent)
        public static let onAccent = Color(Swatch.onAccent)
        public static let accentSoft = Color(Swatch.accentSoft)
        public static let accentInk = Color(Swatch.accentInk)
        public static let sale = Color(Swatch.sale)
        public static let saleSoft = Color(Swatch.saleSoft)
        public static let ok = Color(Swatch.ok)
        public static let okSoft = Color(Swatch.okSoft)
        public static let info = Color(Swatch.info)
        public static let infoSoft = Color(Swatch.infoSoft)
        public static let focus = Color(Swatch.focus)
        public static let glassFill = Color(Swatch.glassFill)
        public static let glassFillStrong = Color(Swatch.glassFillStrong)
        public static let glassBorder = Color(Swatch.glassBorder)
        public static let glassShadow = Color(Swatch.glassShadow)
    }

    // MARK: - Shape

    /// Glass-layer radii (`--r-sm/md/lg`).
    public enum Radius {
        public static let small: CGFloat = 12
        public static let medium: CGFloat = 20
        public static let large: CGFloat = 28
        /// The logo mark (`.logo-mark`, 9px at 32px).
        public static let logoMark: CGFloat = 9
    }

    /// A 4-pt grid.
    public enum Spacing {
        public static let xxs: CGFloat = 4
        public static let xs: CGFloat = 8
        public static let sm: CGFloat = 12
        public static let md: CGFloat = 16
        public static let lg: CGFloat = 20
        public static let xl: CGFloat = 24
        public static let xxl: CGFloat = 32
        /// The screen's side gutter.
        public static let gutter: CGFloat = 16
    }

    public enum Size {
        /// Minimum hit target (HIG).
        public static let minTap: CGFloat = 44
        public static let buttonHeight: CGFloat = 50
        public static let chipHeight: CGFloat = 34
    }

    // MARK: - Type

    /// The glass layer uses the system font (`-apple-system, SF Pro Text`). Sizes are Dynamic Type
    /// text styles, so they scale; weights follow the prototype (700 titles, 600 labels).
    public enum Typography {
        public static let largeTitle = Font.system(.largeTitle, design: .default).weight(.bold)
        public static let title = Font.system(.title2).weight(.bold)
        public static let headline = Font.system(.headline).weight(.semibold)
        public static let body = Font.system(.body)
        public static let callout = Font.system(.callout)
        public static let label = Font.system(.subheadline).weight(.semibold)
        public static let caption = Font.system(.caption)
        /// Prices: tabular figures so columns of amounts line up.
        public static let price = Font.system(.headline).weight(.bold).monospacedDigit()
        public static let priceSecondary = Font.system(.caption).monospacedDigit()
        /// The logo wordmark (`.logo`, 19px / 700).
        public static let wordmark = Font.system(size: 19, weight: .bold)
    }
}
