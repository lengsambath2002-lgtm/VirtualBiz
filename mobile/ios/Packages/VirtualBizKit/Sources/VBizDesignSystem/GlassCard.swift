import SwiftUI

/// The Liquid Glass material for cards and panels (`.panel`, `.card`, … in the glass layer):
/// a translucent fill over a blur, a bright hairline border and a soft shadow.
///
/// With **Reduce Transparency** on, the card draws the solid surface colour instead — no blur and
/// no see-through fill, as the accessibility setting asks.
public struct GlassBackground: ViewModifier {
    let cornerRadius: CGFloat
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    public init(cornerRadius: CGFloat = VBiz.Radius.medium) {
        self.cornerRadius = cornerRadius
    }

    public func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        content
            .background {
                if reduceTransparency {
                    shape.fill(VBiz.Palette.surface)
                } else {
                    shape.fill(.ultraThinMaterial)
                    shape.fill(VBiz.Palette.glassFill)
                }
            }
            .overlay { shape.strokeBorder(reduceTransparency ? VBiz.Palette.line : VBiz.Palette.glassBorder) }
            .shadow(color: VBiz.Palette.glassShadow, radius: 14, x: 0, y: 8)
    }
}

public extension View {
    func glassBackground(cornerRadius: CGFloat = VBiz.Radius.medium) -> some View {
        modifier(GlassBackground(cornerRadius: cornerRadius))
    }
}

/// A padded container on the glass material.
public struct GlassCard<Content: View>: View {
    private let padding: CGFloat
    private let cornerRadius: CGFloat
    private let content: Content

    public init(padding: CGFloat = VBiz.Spacing.md, cornerRadius: CGFloat = VBiz.Radius.medium,
                @ViewBuilder content: () -> Content) {
        self.padding = padding
        self.cornerRadius = cornerRadius
        self.content = content()
    }

    public var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .glassBackground(cornerRadius: cornerRadius)
    }
}

/// The page backdrop (`--wall` over `--bg`): soft yellow, blue and violet glows the glass refracts.
public struct GlassWallpaper: View {
    public init() {}

    public var body: some View {
        ZStack {
            VBiz.Palette.background
            RadialGradient(colors: [VBiz.Palette.accent.opacity(0.20), .clear], center: UnitPoint(x: 0.08, y: -0.12),
                           startRadius: 0, endRadius: 520)
            RadialGradient(colors: [VBiz.Palette.focus.opacity(0.16), .clear], center: UnitPoint(x: 1.05, y: 0),
                           startRadius: 0, endRadius: 460)
            RadialGradient(colors: [Color(ColorPair(0x7C5CFA)).opacity(0.12), .clear], center: UnitPoint(x: 0.4, y: 1.15),
                           startRadius: 0, endRadius: 480)
        }
        .ignoresSafeArea()
    }
}

struct GlassCard_Previews: PreviewProvider {
    static var previews: some View {
        ZStack {
            GlassWallpaper()
            GlassCard {
                VStack(alignment: .leading, spacing: VBiz.Spacing.xs) {
                    Text("Happy Coffee").font(VBiz.Typography.headline)
                    Text("Toul Kork · 0.9 km").font(VBiz.Typography.caption).foregroundStyle(VBiz.Palette.muted)
                }
            }
            .padding()
        }
    }
}
