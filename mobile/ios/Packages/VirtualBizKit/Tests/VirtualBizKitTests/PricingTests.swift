import Foundation
import Testing
@testable import VBizDomain

private let now = Date(timeIntervalSince1970: 1_791_523_800)
private let zones = [
    DeliveryZone(label: "Central", districts: ["bkk1", "daun-penh"], fee: Money(0.75)),
    DeliveryZone(label: "Inner", districts: ["toul-kork"], fee: Money(1.5)),
]
private let settings = ProductSettings(autoAccept: false, prepMinutes: 20, lowStockDefault: 5, pickup: true, cod: true,
                                       freeDeliveryOver: Money(25), zones: zones)

@Test("delivery fee is the zone fee, free over the shop threshold, free for pickup")
func deliveryFee() {
    #expect(DeliveryFee.quote(method: .delivery, subtotal: Money(18), district: "bkk1", settings: settings) == .fee(Money(0.75)))
    #expect(DeliveryFee.quote(method: .delivery, subtotal: Money(18), district: "toul-kork", settings: settings) == .fee(Money(1.5)))
    #expect(DeliveryFee.quote(method: .delivery, subtotal: Money(25), district: "toul-kork", settings: settings) == .fee(.zero))
    #expect(DeliveryFee.quote(method: .pickup, subtotal: Money(1), district: nil, settings: settings) == .fee(.zero))
    #expect(DeliveryFee.quote(method: .delivery, subtotal: Money(10), district: "por-senchey", settings: settings) == .notDelivered)
    #expect(DeliveryFee.amountToFreeDelivery(subtotal: Money(18.5), settings: settings) == Money(6.5))
    #expect(DeliveryFee.amountToFreeDelivery(subtotal: Money(30), settings: settings) == nil)
}

@Test("net price rounds to cents; the sale badge is the whole-number percent")
func netPrice() {
    #expect(Pricing.netPrice(Money(2.5), discountPct: 20) == Money(2))
    #expect(Pricing.netPrice(Money(829), discountPct: 5) == Money(787.55))
    #expect(Pricing.netPrice(Money(18), discountPct: 15) == Money(15.3))
    #expect(Pricing.netPrice(Money(7.5), discountPct: nil) == Money(7.5))
    #expect(Pricing.netPrice(Money(7.5), discountPct: 0) == Money(7.5))
    #expect(Pricing.discountPercent(price: Money(224.1), compareAt: Money(249)) == 10)
    #expect(Pricing.discountPercent(price: Money(12), compareAt: nil) == nil)
    #expect(Pricing.discountPercent(price: Money(12), compareAt: Money(10)) == nil)
}

private func promo(_ type: PromotionType, value: Decimal, minSpend: Money? = nil, maxDiscount: Money? = nil,
                   scope: PromotionScope = .all, targets: [String] = [], uses: Int = 0, limit: Int? = nil,
                   startsAt: Date = now.addingTimeInterval(-86_400), endsAt: Date = now.addingTimeInterval(86_400)) -> Promotion {
    Promotion(id: "p", name: "test", type: type, value: value, code: "CODE", scope: scope, targetIds: targets,
              minSpend: minSpend, maxDiscount: maxDiscount, startsAt: startsAt, endsAt: endsAt, uses: uses, usageLimit: limit)
}

private func lines(_ amounts: [(String, String, Double)]) -> [PromoLine] {
    amounts.map { PromoLine(productId: $0.0, categoryId: $0.1, amount: Money($0.2)) }
}

@Test("WATERFEST: 10% off, capped at $5")
func percentPromo() {
    let waterfest = promo(.percent, value: 10, maxDiscount: Money(5))
    #expect(PromoCalculator.outcome(waterfest, lines: lines([("a", "c", 30)]), at: now).discount == Money(3))
    #expect(PromoCalculator.outcome(waterfest, lines: lines([("a", "c", 80)]), at: now).discount == Money(5))
}

@Test("NEW5: $5 off orders over $20, and the shortfall when below")
func fixedPromo() {
    let new5 = promo(.fixed, value: 5, minSpend: Money(20))
    #expect(PromoCalculator.outcome(new5, lines: lines([("a", "c", 25)]), at: now).discount == Money(5))
    let short = PromoCalculator.outcome(new5, lines: lines([("a", "c", 18)]), at: now)
    #expect(short.discount == .zero)
    #expect(short.shortfall == Money(2))
    #expect(!short.applies)
    // A fixed discount never exceeds the eligible subtotal.
    let big = promo(.fixed, value: 50)
    #expect(PromoCalculator.outcome(big, lines: lines([("a", "c", 12)]), at: now).discount == Money(12))
}

@Test("scoped promos only count the covered lines")
func scopedPromo() {
    let cart = lines([("case15", "accessories", 12), ("iphone15", "phones", 829)])
    let products = promo(.fixed, value: 3, minSpend: Money(12), scope: .products, targets: ["case15"])
    #expect(PromoCalculator.outcome(products, lines: cart, at: now).discount == Money(3))
    let category = promo(.percent, value: 10, scope: .category, targets: ["phones"])
    #expect(PromoCalculator.outcome(category, lines: cart, at: now).discount == Money(82.9))
    let none = promo(.percent, value: 10, scope: .products, targets: ["mba"])
    #expect(PromoCalculator.outcome(none, lines: cart, at: now) == .none)
}

@Test("free shipping waives delivery; inactive promos give nothing")
func freeShippingAndState() {
    let ship = promo(.freeShipping, value: 0, minSpend: Money(15))
    #expect(PromoCalculator.outcome(ship, lines: lines([("a", "c", 20)]), at: now).waivesDelivery)
    let scheduled = promo(.percent, value: 10, startsAt: now.addingTimeInterval(3600))
    #expect(scheduled.state(at: now) == .scheduled)
    #expect(PromoCalculator.outcome(scheduled, lines: lines([("a", "c", 20)]), at: now) == .none)
    let ended = promo(.percent, value: 10, endsAt: now)
    #expect(ended.state(at: now) == .ended)
    let usedUp = promo(.percent, value: 10, uses: 50, limit: 50)
    #expect(usedUp.state(at: now) == .usedUp)
    #expect(promo(.percent, value: 10, uses: 50, limit: nil).state(at: now) == .active)
}
