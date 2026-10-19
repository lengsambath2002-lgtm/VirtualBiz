import VBizDesignSystem
import VBizDomain

extension PriceLabel {
    /// A price label from domain money — the one place the app turns `Money` into price text,
    /// so KHR is always rounded by `Money.khr`.
    init(_ price: Money, compareAt: Money? = nil, size: Size = .regular) {
        self.init(usd: price.usdText, khr: price.khrText, compareAt: compareAt?.usdText, size: size)
    }
}
