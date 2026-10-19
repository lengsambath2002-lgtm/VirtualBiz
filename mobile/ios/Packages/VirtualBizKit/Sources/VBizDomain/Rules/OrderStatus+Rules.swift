import Foundation

/// The order state machine (open question #5: the seller's enum is the source).
///
/// ```
/// NEW ─▶ ACCEPTED ─▶ PACKED ─▶ SHIPPED ─▶ DELIVERED ─▶ RETURNED     (delivery)
///                       └────────────▶ PICKED_UP ─▶ RETURNED        (pickup)
/// NEW / ACCEPTED / PACKED ─▶ CANCELLED
/// ```
/// For a pickup order `PACKED` *is* "Ready for pickup"; it never passes through `SHIPPED`.
public extension OrderStatus {
    var isTerminal: Bool { self == .cancelled || self == .returned }

    /// The order has reached the customer (the return window runs from here).
    var isFulfilled: Bool { self == .delivered || self == .pickedUp }

    func allowedNext(method: FulfilmentMethod) -> Set<OrderStatus> {
        switch self {
        case .new: return [.accepted, .cancelled]
        case .accepted: return [.packed, .cancelled]
        case .packed: return method == .delivery ? [.shipped, .cancelled] : [.pickedUp, .cancelled]
        case .shipped: return method == .delivery ? [.delivered] : []
        case .delivered, .pickedUp: return [.returned]
        case .cancelled, .returned: return []
        }
    }

    func canTransition(to next: OrderStatus, method: FulfilmentMethod) -> Bool {
        allowedNext(method: method).contains(next)
    }

    /// The customer-facing label (domain-model.md "Customer-facing order labels").
    /// `PACKED` reads "Ready for pickup" for pickup orders and "Ready" for delivery.
    func customerLabel(method: FulfilmentMethod) -> String {
        switch self {
        case .new: return "Order placed"
        case .accepted: return "Preparing"
        case .packed: return method == .pickup ? "Ready for pickup" : "Ready"
        case .shipped: return "On the way"
        case .delivered: return "Delivered"
        case .pickedUp: return "Picked up"
        case .cancelled: return "Cancelled"
        case .returned: return "Returned"
        }
    }

    /// The localization key for `customerLabel` (the app's String Catalog holds en + km).
    func customerLabelKey(method: FulfilmentMethod) -> String {
        switch self {
        case .new: return "order.status.placed"
        case .accepted: return "order.status.preparing"
        case .packed: return method == .pickup ? "order.status.readyForPickup" : "order.status.ready"
        case .shipped: return "order.status.onTheWay"
        case .delivered: return "order.status.delivered"
        case .pickedUp: return "order.status.pickedUp"
        case .cancelled: return "order.status.cancelled"
        case .returned: return "order.status.returned"
        }
    }

    /// The happy-path steps the customer's tracker draws.
    static func customerSteps(method: FulfilmentMethod) -> [OrderStatus] {
        method == .delivery
            ? [.new, .accepted, .packed, .shipped, .delivered]
            : [.new, .accepted, .packed, .pickedUp]
    }
}

/// Time-based order rules from the prototype.
public enum OrderRules {
    /// The customer may cancel while `NEW` and within this window.
    public static let customerCancelWindow: TimeInterval = 5 * 60
    /// An order not accepted within this window is auto-cancelled.
    public static let autoCancelAfter: TimeInterval = 60 * 60
    /// Returns are allowed for this long after delivery.
    public static let returnWindow: TimeInterval = 7 * 24 * 60 * 60
    /// Commission on `ONLINE` channel payments only.
    public static let commissionRate: Decimal = 0.05

    public static func customerCanCancel(_ order: Order, now: Date) -> Bool {
        order.status == .new && now.timeIntervalSince(order.createdAt) <= customerCancelWindow
    }

    public static func shouldAutoCancel(_ order: Order, now: Date) -> Bool {
        order.status == .new && now.timeIntervalSince(order.createdAt) > autoCancelAfter
    }

    public static func canReturn(_ order: Order, now: Date) -> Bool {
        guard order.status.isFulfilled,
              let fulfilledAt = order.timeline.last(where: { $0.status.isFulfilled })?.at else { return false }
        return now.timeIntervalSince(fulfilledAt) <= returnWindow
    }

    public static func commission(on order: Order) -> Money {
        guard order.payment.channel == .online else { return .zero }
        return Money(order.total.amount * commissionRate)
    }
}
