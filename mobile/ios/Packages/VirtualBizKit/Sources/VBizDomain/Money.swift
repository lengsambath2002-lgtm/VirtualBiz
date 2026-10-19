import Foundation

/// A USD amount with two decimal places — the only currency the platform stores.
///
/// KHR is never stored; it is derived for display as `round(usd × 4100 / 100) × 100`
/// (domain-model.md, CLAUDE.md "Money"). Use these helpers for every KHR figure on screen so the
/// app, the web and the backend round the same way.
///
/// On the wire a `Money` is a bare JSON number (`"subtotal": 18.5`). Decoding rounds to cents, so
/// a Double-backed decoder cannot leak `224.09999…` into a total.
public struct Money: Sendable, Hashable, Comparable, Codable {
    /// Riel per US dollar. Mirrors `meta.rate`; replace with the server value once the API exists.
    public static let khrPerUsd: Decimal = 4100
    /// KHR amounts are shown rounded to the nearest 100 riel (the smallest note in daily use).
    public static let khrRounding: Decimal = 100

    public static let zero = Money(0)

    /// USD, always rounded to 2 decimal places.
    public let amount: Decimal

    public init(_ amount: Decimal) {
        self.amount = amount.rounded(scale: 2)
    }

    /// Convenience for literals in mock data and tests (`Money(2.5)`), parsed through the
    /// decimal string so binary floating point never reaches the stored value.
    public init(_ amount: Double) {
        self.init(Decimal(string: String(amount)) ?? Decimal(amount))
    }

    public init(_ amount: Int) {
        self.init(Decimal(amount))
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let text = try? container.decode(String.self), let value = Decimal(string: text) {
            self.init(value)
        } else {
            self.init(try container.decode(Decimal.self))
        }
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(amount)
    }

    public static func < (lhs: Money, rhs: Money) -> Bool { lhs.amount < rhs.amount }
    public static func + (lhs: Money, rhs: Money) -> Money { Money(lhs.amount + rhs.amount) }
    public static func - (lhs: Money, rhs: Money) -> Money { Money(lhs.amount - rhs.amount) }
    public static func * (lhs: Money, rhs: Int) -> Money { Money(lhs.amount * Decimal(rhs)) }
    public static func += (lhs: inout Money, rhs: Money) { lhs = lhs + rhs }

    public var isZero: Bool { amount == 0 }

    /// The riel equivalent: `round(usd × 4100 / 100) × 100`.
    public var khr: Int {
        Money.khr(fromUsd: amount)
    }

    public static func khr(fromUsd usd: Decimal) -> Int {
        let hundreds = (usd * khrPerUsd / khrRounding).rounded(scale: 0)
        return NSDecimalNumber(decimal: hundreds * khrRounding).intValue
    }

    /// Rounds a riel figure to the nearest 100 (the POS `rielRound`).
    public static func roundRiel(_ riel: Decimal) -> Int {
        NSDecimalNumber(decimal: (riel / khrRounding).rounded(scale: 0) * khrRounding).intValue
    }

    /// `$1,234.50`
    public var usdText: String { Money.usdText(amount) }

    /// `10,300 KHR`
    public var khrText: String { "\(Money.grouped(khr)) KHR" }

    public static func usdText(_ amount: Decimal) -> String {
        let sign = amount < 0 ? "-" : ""
        let text = abs(amount).formatted(
            .number.precision(.fractionLength(2)).grouping(.automatic).locale(Locale(identifier: "en_US"))
        )
        return "\(sign)$\(text)"
    }

    static func grouped(_ value: Int) -> String {
        value.formatted(.number.grouping(.automatic).locale(Locale(identifier: "en_US")))
    }
}

// MARK: - Cash change

/// Change for a cash sale, given in whole dollars plus the remaining cents in riel — the way a
/// Phnom Penh till actually pays out (US coins are not in circulation). From the seller POS:
/// `Give change: $X + N KHR`.
public struct CashChange: Sendable, Hashable {
    public let dollars: Int
    public let riel: Int

    public init(change: Money) {
        let positive = max(change.amount, 0)
        let wholeDollars = positive.rounded(scale: 0, mode: .down)
        dollars = NSDecimalNumber(decimal: wholeDollars).intValue
        riel = Money.roundRiel((positive - wholeDollars) * Money.khrPerUsd)
    }

    public var isZero: Bool { dollars == 0 && riel == 0 }

    /// `$3 + 2,100 KHR`, or `$3` when no riel is owed.
    public var text: String {
        riel == 0 ? "$\(dollars)" : "$\(dollars) + \(Money.grouped(riel)) KHR"
    }
}

// MARK: - Decimal helpers

public extension Decimal {
    /// Rounds to `scale` decimal places. `.plain` rounds half away from zero, matching the web's
    /// `toFixed` / `Math.round` for the positive amounts money deals in.
    func rounded(scale: Int, mode: NSDecimalNumber.RoundingMode = .plain) -> Decimal {
        var input = self
        var output = Decimal()
        NSDecimalRound(&output, &input, scale, mode)
        return output
    }
}
