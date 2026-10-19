import Foundation

public struct CartLine: Sendable, Hashable, Codable, Identifiable {
    public var id: String
    public var variantId: String
    public var qty: Int
    public var selected: Bool
    public var savedForLater: Bool

    public init(id: String, variantId: String, qty: Int, selected: Bool = true, savedForLater: Bool = false) {
        self.id = id
        self.variantId = variantId
        self.qty = qty
        self.selected = selected
        self.savedForLater = savedForLater
    }
}

public struct OrderLine: Sendable, Hashable, Codable {
    public var variantId: String
    public var title: String
    public var variantName: String
    public var qty: Int
    public var unitPrice: Money

    public init(variantId: String, title: String, variantName: String, qty: Int, unitPrice: Money) {
        self.variantId = variantId
        self.title = title
        self.variantName = variantName
        self.qty = qty
        self.unitPrice = unitPrice
    }

    public var lineTotal: Money { unitPrice * qty }
}

public struct Payment: Sendable, Hashable, Codable {
    public var method: PaymentMethod
    public var channel: PaymentChannel
    public var paid: Bool

    public init(method: PaymentMethod, channel: PaymentChannel, paid: Bool) {
        self.method = method
        self.channel = channel
        self.paid = paid
    }
}

public struct OrderTimelineEntry: Sendable, Hashable, Codable {
    public var status: OrderStatus
    public var at: Date

    public init(status: OrderStatus, at: Date) {
        self.status = status
        self.at = at
    }
}

public struct Rider: Sendable, Hashable, Codable {
    public var name: String
    public var vehicle: String
    public var plate: String

    public init(name: String, vehicle: String, plate: String) {
        self.name = name
        self.vehicle = vehicle
        self.plate = plate
    }
}

/// One order per business (checkout splits a cart by shop).
public struct Order: Sendable, Hashable, Codable, Identifiable {
    public var id: String
    /// `VB-00001` (open question #9) — see `DisplayNumber`.
    public var number: String
    public var businessId: String
    public var customerId: String
    public var lines: [OrderLine]
    public var subtotal: Money
    public var discount: Money
    public var promoCode: String?
    public var deliveryFee: Money
    public var total: Money
    public var payment: Payment
    public var method: FulfilmentMethod
    public var address: Address?
    /// `nil` = as soon as possible.
    public var scheduledFor: Date?
    public var note: String?
    public var status: OrderStatus
    public var timeline: [OrderTimelineEntry]
    public var rider: Rider?
    public var cancelReason: String?
    public var reviewed: Bool
    public var createdAt: Date

    public init(id: String, number: String, businessId: String, customerId: String, lines: [OrderLine],
                subtotal: Money, discount: Money, promoCode: String? = nil, deliveryFee: Money, total: Money,
                payment: Payment, method: FulfilmentMethod, address: Address? = nil, scheduledFor: Date? = nil,
                note: String? = nil, status: OrderStatus, timeline: [OrderTimelineEntry], rider: Rider? = nil,
                cancelReason: String? = nil, reviewed: Bool = false, createdAt: Date) {
        self.id = id
        self.number = number
        self.businessId = businessId
        self.customerId = customerId
        self.lines = lines
        self.subtotal = subtotal
        self.discount = discount
        self.promoCode = promoCode
        self.deliveryFee = deliveryFee
        self.total = total
        self.payment = payment
        self.method = method
        self.address = address
        self.scheduledFor = scheduledFor
        self.note = note
        self.status = status
        self.timeline = timeline
        self.rider = rider
        self.cancelReason = cancelReason
        self.reviewed = reviewed
        self.createdAt = createdAt
    }

    public var itemCount: Int { lines.reduce(0) { $0 + $1.qty } }

    /// What the customer reads for the current status.
    public var customerLabel: String { status.customerLabel(method: method) }
}
