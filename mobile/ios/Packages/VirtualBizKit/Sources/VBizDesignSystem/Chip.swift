import SwiftUI

/// A filter / category pill (`.chip`, `.chip.on`). Selected chips take the primary fill.
public struct Chip: View {
    private let title: String
    private let systemImage: String?
    private let isSelected: Bool
    private let action: () -> Void

    /// `title` is already localized by the caller (chips usually show data such as a category name).
    public init(_ title: String, systemImage: String? = nil, isSelected: Bool = false, action: @escaping () -> Void) {
        self.title = title
        self.systemImage = systemImage
        self.isSelected = isSelected
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            HStack(spacing: VBiz.Spacing.xxs + 2) {
                if let systemImage { Image(systemName: systemImage).imageScale(.small) }
                Text(title).lineLimit(1)
            }
            .font(VBiz.Typography.label)
            .foregroundStyle(isSelected ? VBiz.Palette.onPrimary : VBiz.Palette.ink)
            .padding(.horizontal, VBiz.Spacing.sm + 2)
            .frame(minHeight: VBiz.Size.chipHeight)
            .background(isSelected ? VBiz.Palette.primary : VBiz.Palette.glassFillStrong, in: Capsule())
            .overlay { Capsule().strokeBorder(isSelected ? Color.clear : VBiz.Palette.line) }
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .frame(minHeight: VBiz.Size.minTap)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

struct Chip_Previews: PreviewProvider {
    static var previews: some View {
        HStack {
            Chip("All", isSelected: true) {}
            Chip("Café", systemImage: "cup.and.saucer") {}
            Chip("Spa", systemImage: "leaf") {}
        }
        .padding()
        .background(VBiz.Palette.background)
    }
}
