import Foundation

/// Delivery pricing (open question #7: the seller's zones, per shop; free-over is per shop).
///
/// - Pickup is free.
/// - Delivery is free when the shop subtotal is at least `freeDeliveryOver`.
/// - Otherwise the fee is the zone fee for the customer's district.
public enum DeliveryFee {
    public enum Quote: Sendable, Hashable {
        case fee(Money)
        /// The shop has no zone covering the district.
        case notDelivered

        public var amount: Money? {
            if case .fee(let money) = self { return money }
            return nil
        }
    }

    public static func quote(method: FulfilmentMethod, subtotal: Money, district: String?,
                             settings: ProductSettings) -> Quote {
        if method == .pickup { return .fee(.zero) }
        if let freeOver = settings.freeDeliveryOver, subtotal >= freeOver { return .fee(.zero) }
        guard let district, let zone = settings.zones.first(where: { $0.districts.contains(district) }) else {
            return .notDelivered
        }
        return .fee(zone.fee)
    }

    /// How much more the customer must add for free delivery, or `nil` if it is already free or
    /// the shop has no threshold.
    public static func amountToFreeDelivery(subtotal: Money, settings: ProductSettings) -> Money? {
        guard let freeOver = settings.freeDeliveryOver, subtotal < freeOver else { return nil }
        return freeOver - subtotal
    }
}
