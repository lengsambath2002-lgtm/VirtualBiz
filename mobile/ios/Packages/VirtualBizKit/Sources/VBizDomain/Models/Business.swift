import Foundation

public struct Closure: Sendable, Hashable, Codable {
    public var date: LocalDate
    public var reason: String

    public init(date: LocalDate, reason: String) {
        self.date = date
        self.reason = reason
    }
}

public struct Business: Sendable, Hashable, Codable, Identifiable {
    public var id: String
    public var ownerId: String
    public var type: BusinessType
    public var name: String
    public var slug: String
    public var categoryId: String
    public var about: String?
    public var phone: String
    public var email: String?
    /// A `District.id`.
    public var district: String
    public var street: String
    /// Seven entries, Monday first. `nil` = closed that day.
    public var hours: [MinuteRange?]
    public var closures: [Closure]
    public var online: Bool
    public var logoUrl: URL?
    public var coverUrl: URL?
    public var bakongId: String
    public var verification: VerificationStatus
    public var rating: Double
    public var reviewCount: Int
    /// The year the shop opened.
    public var since: Int
    /// Present when `type == .product`.
    public var productSettings: ProductSettings?
    /// Present when `type == .service`.
    public var bookingSettings: BookingSettings?
}

public struct DeliveryZone: Sendable, Hashable, Codable {
    public var label: String
    /// `District.id`s.
    public var districts: [String]
    public var fee: Money

    public init(label: String, districts: [String], fee: Money) {
        self.label = label
        self.districts = districts
        self.fee = fee
    }
}

/// Settings of a `PRODUCT` business.
public struct ProductSettings: Sendable, Hashable, Codable {
    public var autoAccept: Bool
    public var prepMinutes: Int
    public var lowStockDefault: Int
    public var pickup: Bool
    public var cod: Bool
    public var freeDeliveryOver: Money?
    public var zones: [DeliveryZone]

    public init(autoAccept: Bool, prepMinutes: Int, lowStockDefault: Int, pickup: Bool, cod: Bool,
                freeDeliveryOver: Money?, zones: [DeliveryZone]) {
        self.autoAccept = autoAccept
        self.prepMinutes = prepMinutes
        self.lowStockDefault = lowStockDefault
        self.pickup = pickup
        self.cod = cod
        self.freeDeliveryOver = freeDeliveryOver
        self.zones = zones
    }
}

/// Settings of a `SERVICE` business.
public struct BookingSettings: Sendable, Hashable, Codable {
    public var onlineBooking: Bool
    public var autoConfirm: Bool
    /// Open question #3: the provider's setting decides; default 24 h.
    public var reminderHours: Int
    public var minNoticeHours: Int
    public var freeCancelHours: Int
    public var bufferMinutes: Int

    public init(onlineBooking: Bool, autoConfirm: Bool, reminderHours: Int = 24, minNoticeHours: Int,
                freeCancelHours: Int, bufferMinutes: Int) {
        self.onlineBooking = onlineBooking
        self.autoConfirm = autoConfirm
        self.reminderHours = reminderHours
        self.minNoticeHours = minNoticeHours
        self.freeCancelHours = freeCancelHours
        self.bufferMinutes = bufferMinutes
    }
}

public struct BusinessMember: Sendable, Hashable, Codable, Identifiable {
    public var id: String
    public var businessId: String
    public var userId: String?
    public var name: String
    public var role: MemberRole
    /// Free text for the calendar, e.g. "Nail technician" (open question #12).
    public var title: String?
    /// `#RRGGBB`.
    public var color: String?
    /// Seven entries, Monday first. `nil` = day off.
    public var shifts: [MinuteRange?]
    public var active: Bool
}
