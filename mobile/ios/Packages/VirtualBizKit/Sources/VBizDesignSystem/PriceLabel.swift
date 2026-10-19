import SwiftUI

/// A price in USD with its riel equivalent underneath (`$2.00` / `≈ 8,200 KHR`), and the struck
/// "was" price when on sale.
///
/// Takes already-formatted text: the design system knows nothing about money rules. The app
/// builds these strings with `VBizDomain.Money` (the one place KHR is rounded) — see the
/// `PriceLabel(_ money:)` convenience in the app target.
public struct PriceLabel: View {
    public enum Size: Sendable { case regular, large }

    private let usd: String
    private let khr: String?
    private let compareAt: String?
    private let size: Size

    public init(usd: String, khr: String?, compareAt: String? = nil, size: Size = .regular) {
        self.usd = usd
        self.khr = khr
        self.compareAt = compareAt
        self.size = size
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .firstTextBaseline, spacing: VBiz.Spacing.xs - 2) {
                Text(usd)
                    .font(size == .large ? VBiz.Typography.title.monospacedDigit() : VBiz.Typography.price)
                    .foregroundStyle(compareAt == nil ? VBiz.Palette.ink : VBiz.Palette.sale)
                if let compareAt {
                    Text(compareAt)
                        .font(VBiz.Typography.priceSecondary)
                        .strikethrough()
                        .foregroundStyle(VBiz.Palette.muted)
                }
            }
            if let khr {
                Text("≈ \(khr)")
                    .font(VBiz.Typography.priceSecondary)
                    .foregroundStyle(VBiz.Palette.muted)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

struct PriceLabel_Previews: PreviewProvider {
    static var previews: some View {
        VStack(alignment: .leading, spacing: VBiz.Spacing.md) {
            PriceLabel(usd: "$2.00", khr: "8,200 KHR", compareAt: "$2.50")
            PriceLabel(usd: "$829.00", khr: "3,398,900 KHR", size: .large)
        }
        .padding()
        .background(VBiz.Palette.background)
    }
}
