import SwiftUI

/// The prototype's capsule buttons (`.btn-primary`, `.btn-accent`): full-width by default,
/// 50 pt tall, a pressed state, and dimmed when disabled.
public struct CapsuleButtonStyle: ButtonStyle {
    public enum Kind: Sendable {
        /// Navy on light, yellow on dark (`--primary`).
        case primary
        /// Always the VirtualBiz yellow with ink text.
        case accent
        /// A quiet glass capsule (`.btn-ghost`).
        case secondary
    }

    let kind: Kind
    let fullWidth: Bool
    @Environment(\.isEnabled) private var isEnabled

    public init(_ kind: Kind, fullWidth: Bool = true) {
        self.kind = kind
        self.fullWidth = fullWidth
    }

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(VBiz.Typography.label)
            .foregroundStyle(foreground)
            .padding(.horizontal, VBiz.Spacing.lg)
            .frame(maxWidth: fullWidth ? .infinity : nil, minHeight: VBiz.Size.buttonHeight)
            .background(background(pressed: configuration.isPressed), in: Capsule())
            .overlay {
                if kind == .secondary { Capsule().strokeBorder(VBiz.Palette.line) }
            }
            .opacity(isEnabled ? 1 : 0.45)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
            .contentShape(Capsule())
    }

    private var foreground: Color {
        switch kind {
        case .primary: return VBiz.Palette.onPrimary
        case .accent: return VBiz.Palette.onAccent
        case .secondary: return VBiz.Palette.ink
        }
    }

    private func background(pressed: Bool) -> Color {
        switch kind {
        case .primary: return pressed ? VBiz.Palette.primaryPressed : VBiz.Palette.primary
        case .accent: return pressed ? VBiz.Palette.accent.opacity(0.85) : VBiz.Palette.accent
        case .secondary: return pressed ? VBiz.Palette.sunk : VBiz.Palette.glassFillStrong
        }
    }
}

/// The main call to action ("Place order", "Sign in").
public struct PrimaryButton: View {
    private let title: LocalizedStringKey
    private let systemImage: String?
    private let action: () -> Void

    public init(_ title: LocalizedStringKey, systemImage: String? = nil, action: @escaping () -> Void) {
        self.title = title
        self.systemImage = systemImage
        self.action = action
    }

    public var body: some View {
        Button(action: action) { ButtonLabel(title: title, systemImage: systemImage) }
            .buttonStyle(CapsuleButtonStyle(.primary))
    }
}

/// The yellow highlight action ("Add to cart", "Book now").
public struct AccentButton: View {
    private let title: LocalizedStringKey
    private let systemImage: String?
    private let action: () -> Void

    public init(_ title: LocalizedStringKey, systemImage: String? = nil, action: @escaping () -> Void) {
        self.title = title
        self.systemImage = systemImage
        self.action = action
    }

    public var body: some View {
        Button(action: action) { ButtonLabel(title: title, systemImage: systemImage) }
            .buttonStyle(CapsuleButtonStyle(.accent))
    }
}

private struct ButtonLabel: View {
    let title: LocalizedStringKey
    let systemImage: String?

    var body: some View {
        HStack(spacing: VBiz.Spacing.xs) {
            if let systemImage { Image(systemName: systemImage) }
            Text(title)
        }
    }
}

struct Buttons_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: VBiz.Spacing.sm) {
            PrimaryButton("Place order") {}
            AccentButton("Add to cart", systemImage: "cart") {}
            Button("Cancel") {}.buttonStyle(CapsuleButtonStyle(.secondary))
            PrimaryButton("Disabled") {}.disabled(true)
        }
        .padding()
        .background(VBiz.Palette.background)
    }
}
