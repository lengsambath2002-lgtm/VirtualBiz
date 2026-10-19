import Foundation

/// Price arithmetic shared by cart, checkout and POS. All results are rounded to cents.
public enum Pricing {
    private static let hundred: Decimal = 100

    /// `price × (1 − pct/100)`, rounded to cents (the prototype's `net`).
    public static func netPrice(_ price: Money, discountPct: Int?) -> Money {
        guard let pct = discountPct, pct > 0 else { return price }
        let clamped = Decimal(min(pct, 100))
        return Money(price.amount * (hundred - clamped) / hundred)
    }

    /// The whole-number "-20%" badge for a variant on sale, or `nil` when not discounted.
    public static func discountPercent(price: Money, compareAt: Money?) -> Int? {
        guard let was = compareAt, was > price, was.amount > 0 else { return nil }
        let pct = ((was.amount - price.amount) / was.amount * hundred).rounded(scale: 0)
        return NSDecimalNumber(decimal: pct).intValue
    }

    public static func subtotal(_ lines: [OrderLine]) -> Money {
        lines.reduce(Money.zero) { $0 + $1.lineTotal }
    }
}

// MARK: - Promotions

/// One cart line as a promotion sees it — enough to decide whether a scoped promo applies.
public struct PromoLine: Sendable, Hashable {
    public var productId: String
    public var categoryId: String
    public var amount: Money

    public init(productId: String, categoryId: String, amount: Money) {
        self.productId = productId
        self.categoryId = categoryId
        self.amount = amount
    }
}

public struct PromoOutcome: Sendable, Hashable {
    /// Taken off the items.
    public var discount: Money
    /// `FREE_SHIPPING` promos waive the delivery fee instead of discounting items.
    public var waivesDelivery: Bool
    /// How much more the customer must spend to qualify, when below `minSpend`.
    public var shortfall: Money?

    public static let none = PromoOutcome(discount: .zero, waivesDelivery: false, shortfall: nil)

    public var applies: Bool { discount > .zero || waivesDelivery }
}

public enum PromoCalculator {
    /// The part of the cart a promotion's scope covers.
    public static func eligibleSubtotal(_ promo: Promotion, lines: [PromoLine]) -> Money {
        let covered: [PromoLine]
        switch promo.scope {
        case .all: covered = lines
        case .category: covered = lines.filter { promo.targetIds.contains($0.categoryId) }
        case .products: covered = lines.filter { promo.targetIds.contains($0.productId) }
        }
        return covered.reduce(Money.zero) { $0 + $1.amount }
    }

    /// The discount `promo` gives on `lines` at `now`.
    ///
    /// - Percent: `subtotal × value%`, capped at `maxDiscount` (WATERFEST: 10%, up to $5).
    /// - Fixed: `value`, never more than the eligible subtotal (NEW5: $5 off over $20).
    /// - Free shipping: no item discount; `waivesDelivery`.
    /// `minSpend` is checked against the eligible subtotal.
    public static func outcome(_ promo: Promotion, lines: [PromoLine], at now: Date) -> PromoOutcome {
        guard promo.state(at: now) == .active else { return .none }
        let eligible = eligibleSubtotal(promo, lines: lines)
        guard eligible > .zero else { return .none }
        if let minSpend = promo.minSpend, eligible < minSpend {
            return PromoOutcome(discount: .zero, waivesDelivery: false, shortfall: minSpend - eligible)
        }
        switch promo.type {
        case .percent:
            var discount = Money(eligible.amount * promo.value / 100)
            if let cap = promo.maxDiscount { discount = min(discount, cap) }
            return PromoOutcome(discount: min(discount, eligible), waivesDelivery: false, shortfall: nil)
        case .fixed:
            return PromoOutcome(discount: min(Money(promo.value), eligible), waivesDelivery: false, shortfall: nil)
        case .freeShipping:
            return PromoOutcome(discount: .zero, waivesDelivery: true, shortfall: nil)
        }
    }
}
