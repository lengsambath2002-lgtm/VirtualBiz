import Foundation

public struct PosSaleLine: Sendable, Hashable, Codable {
    public var variantId: String?
    public var serviceId: String?
    public var title: String
    public var qty: Int
    public var unitPrice: Money
    public var staffId: String?
}

public struct PosPayment: Sendable, Hashable, Codable {
    public var method: PaymentMethod
    public var amount: Money
}

/// Cash tendered at the till, in either currency, and the change given.
public struct CashTender: Sendable, Hashable, Codable {
    public var usd: Money
    public var khr: Int
    public var change: Money

    /// `$X + N KHR`.
    public var changeText: String { CashChange(change: change).text }
}

public struct PosRefund: Sendable, Hashable, Codable {
    public var at: Date
    public var amount: Money
    public var method: PaymentMethod
    public var lines: [PosSaleLine]
}

/// A till sale. Number `R-00001` (seller POS) or `S-00001` (provider checkout).
public struct PosSale: Sendable, Hashable, Codable, Identifiable {
    public var id: String
    public var number: String
    public var businessId: String
    public var shiftId: String
    public var lines: [PosSaleLine]
    public var subtotal: Money
    public var discount: Money
    public var tip: Money
    public var total: Money
    public var payments: [PosPayment]
    public var cash: CashTender?
    public var customerId: String?
    public var refunds: [PosRefund]
    public var at: Date
}

public struct CashMove: Sendable, Hashable, Codable {
    public var type: CashMoveType
    public var amount: Money
    public var note: String
}

public struct Shift: Sendable, Hashable, Codable, Identifiable {
    /// A shift balances when |difference| ≤ $0.25.
    public static let balanceTolerance = Money(0.25)

    public var id: String
    public var businessId: String
    public var openedBy: String
    public var openedAt: Date
    public var floatUsd: Money
    public var floatKhr: Int
    public var moves: [CashMove]
    public var closedAt: Date?
    public var countedUsd: Money?
    public var difference: Money?

    public var isBalanced: Bool? {
        difference.map { abs($0.amount) <= Shift.balanceTolerance.amount }
    }
}
