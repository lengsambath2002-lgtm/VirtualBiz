import SwiftUI

/// The VirtualBiz logo: a yellow rounded square with an ink "B", and the wordmark
/// "Virtual**Biz**" with "Biz" in the accent ink (`.logo`, `.logo-mark`).
public struct Logo: View {
    public enum Style: Sendable { case full, markOnly }

    private let style: Style
    private let markSize: CGFloat

    public init(_ style: Style = .full, markSize: CGFloat = 32) {
        self.style = style
        self.markSize = markSize
    }

    public var body: some View {
        HStack(spacing: VBiz.Spacing.xs) {
            LogoMark(size: markSize)
            if style == .full {
                (Text(verbatim: "Virtual").foregroundStyle(VBiz.Palette.ink)
                    + Text(verbatim: "Biz").foregroundStyle(VBiz.Palette.accentInk))
                    .font(VBiz.Typography.wordmark)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: "VirtualBiz"))
    }
}

public struct LogoMark: View {
    private let size: CGFloat

    public init(size: CGFloat = 32) { self.size = size }

    public var body: some View {
        RoundedRectangle(cornerRadius: size * VBiz.Radius.logoMark / 32, style: .continuous)
            .fill(VBiz.Palette.accent)
            .frame(width: size, height: size)
            .overlay {
                Text(verbatim: "B")
                    .font(.system(size: size * 17 / 32, weight: .bold))
                    .foregroundStyle(VBiz.Palette.onAccent)
            }
    }
}

struct Logo_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: VBiz.Spacing.lg) {
            Logo()
            Logo(.markOnly, markSize: 64)
        }
        .padding()
        .background(VBiz.Palette.background)
    }
}
