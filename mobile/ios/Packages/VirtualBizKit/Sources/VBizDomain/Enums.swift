import Foundation

// Every enum in docs/db/domain-model.md, in the order the table lists them.
//
// Wire values are UPPER_SNAKE (the raw value); Swift cases are camelCase. Never rename a raw value
// here without changing the backend, the web client and the domain model doc in the same change.

public enum BusinessType: String, Codable, Sendable, Hashable, CaseIterable {
    case product = "PRODUCT"
    case service = "SERVICE"
}

public enum MemberRole: String, Codable, Sendable, Hashable, CaseIterable {
    case owner = "OWNER"
    case manager = "MANAGER"
    case staff = "STAFF"
}

public enum VerificationStatus: String, Codable, Sendable, Hashable, CaseIterable {
    case pending = "PENDING"
    case verified = "VERIFIED"
    case rejected = "REJECTED"
}

public enum SignInMethod: String, Codable, Sendable, Hashable, CaseIterable {
    case password = "PASSWORD"
    case google = "GOOGLE"
    case emailCode = "EMAIL_CODE"
    case phoneSms = "PHONE_SMS"
}

public enum OtpPurpose: String, Codable, Sendable, Hashable, CaseIterable {
    case verify = "VERIFY"
    case login = "LOGIN"
    case reset = "RESET"
    case phone = "PHONE"
}

public enum ProductStatus: String, Codable, Sendable, Hashable, CaseIterable {
    case active = "ACTIVE"
    case draft = "DRAFT"
}

/// The seller's order lifecycle (open question #5). The customer sees `customerLabel(for:)`.
/// Allowed moves live in `OrderStatus+Rules.swift`.
public enum OrderStatus: String, Codable, Sendable, Hashable, CaseIterable {
    case new = "NEW"
    case accepted = "ACCEPTED"
    case packed = "PACKED"
    case shipped = "SHIPPED"
    case delivered = "DELIVERED"
    case pickedUp = "PICKED_UP"
    case cancelled = "CANCELLED"
    case returned = "RETURNED"
}

public enum FulfilmentMethod: String, Codable, Sendable, Hashable, CaseIterable {
    case delivery = "DELIVERY"
    case pickup = "PICKUP"
}

public enum DeliveryProvider: String, Codable, Sendable, Hashable, CaseIterable {
    case virtualbizRider = "VIRTUALBIZ_RIDER"
    case ownDelivery = "OWN_DELIVERY"
}

/// One enum for every surface (open question #8). Split tender = several payment rows.
public enum PaymentMethod: String, Codable, Sendable, Hashable, CaseIterable {
    case khqr = "KHQR"
    case card = "CARD"
    case cash = "CASH"
}

public enum PaymentChannel: String, Codable, Sendable, Hashable, CaseIterable {
    case online = "ONLINE"
    case cod = "COD"
    case pos = "POS"
}

/// The provider's nine statuses are the source (open question #2).
/// Allowed moves live in `AppointmentStatus+Rules.swift`.
public enum AppointmentStatus: String, Codable, Sendable, Hashable, CaseIterable {
    case requested = "REQUESTED"
    case booked = "BOOKED"
    case confirmed = "CONFIRMED"
    case arrived = "ARRIVED"
    case started = "STARTED"
    case completed = "COMPLETED"
    case noShow = "NO_SHOW"
    case cancelled = "CANCELLED"
    case declined = "DECLINED"
}

public enum AppointmentSource: String, Codable, Sendable, Hashable, CaseIterable {
    case online = "ONLINE"
    case phone = "PHONE"
    case walkIn = "WALK_IN"
}

public enum BlockReason: String, Codable, Sendable, Hashable, CaseIterable {
    case lunch = "LUNCH"
    case `break` = "BREAK"
    case training = "TRAINING"
    case personal = "PERSONAL"
    case cleaning = "CLEANING"
}

public enum StockReason: String, Codable, Sendable, Hashable, CaseIterable {
    case received = "RECEIVED"
    case countCorrection = "COUNT_CORRECTION"
    case damagedLost = "DAMAGED_LOST"
    case customerReturn = "CUSTOMER_RETURN"
    case orderCancelled = "ORDER_CANCELLED"
    case orderSale = "ORDER_SALE"
    case posSale = "POS_SALE"
    case posRefund = "POS_REFUND"
    case quickAdjust = "QUICK_ADJUST"
    case openingStock = "OPENING_STOCK"
    case markedSoldOut = "MARKED_SOLD_OUT"
}

public enum PromotionType: String, Codable, Sendable, Hashable, CaseIterable {
    case percent = "PERCENT"
    case fixed = "FIXED"
    case freeShipping = "FREE_SHIPPING"
}

public enum PromotionScope: String, Codable, Sendable, Hashable, CaseIterable {
    case all = "ALL"
    case category = "CATEGORY"
    case products = "PRODUCTS"
}

/// Derived, never stored: see `Promotion.state(at:)`.
public enum PromotionState: String, Codable, Sendable, Hashable, CaseIterable {
    case active = "ACTIVE"
    case scheduled = "SCHEDULED"
    case usedUp = "USED_UP"
    case ended = "ENDED"
}

public enum AddressLabel: String, Codable, Sendable, Hashable, CaseIterable {
    case home = "HOME"
    case work = "WORK"
    case other = "OTHER"
}

/// `Shift.moves[].type`.
public enum CashMoveType: String, Codable, Sendable, Hashable, CaseIterable {
    case `in` = "IN"
    case out = "OUT"
}
