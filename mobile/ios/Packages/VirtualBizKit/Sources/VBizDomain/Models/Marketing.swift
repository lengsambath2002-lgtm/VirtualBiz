import Foundation

public struct Promotion: Sendable, Hashable, Codable, Identifiable {
    public var id: String
    /// `nil` = platform-wide.
    public var businessId: String?
    public var name: String
    public var type: PromotionType
    /// Percent for `.percent`, USD for `.fixed`, unused for `.freeShipping`.
    public var value: Decimal
    /// `nil` = applied automatically.
    public var code: String?
    public var scope: PromotionScope
    public var targetIds: [String]
    public var minSpend: Money?
    public var maxDiscount: Money?
    public var startsAt: Date
    public var endsAt: Date
    public var uses: Int
    public var usageLimit: Int?

    public init(id: String, businessId: String? = nil, name: String, type: PromotionType, value: Decimal,
                code: String? = nil, scope: PromotionScope = .all, targetIds: [String] = [],
                minSpend: Money? = nil, maxDiscount: Money? = nil, startsAt: Date, endsAt: Date,
                uses: Int = 0, usageLimit: Int? = nil) {
        self.id = id
        self.businessId = businessId
        self.name = name
        self.type = type
        self.value = value
        self.code = code
        self.scope = scope
        self.targetIds = targetIds
        self.minSpend = minSpend
        self.maxDiscount = maxDiscount
        self.startsAt = startsAt
        self.endsAt = endsAt
        self.uses = uses
        self.usageLimit = usageLimit
    }

    /// Derived state: ended beats used-up beats scheduled.
    public func state(at now: Date) -> PromotionState {
        if now >= endsAt { return .ended }
        if let limit = usageLimit, limit > 0, uses >= limit { return .usedUp }
        if now < startsAt { return .scheduled }
        return .active
    }
}

/// A shop "event" shown on the Deals tab.
public struct Deal: Sendable, Hashable, Codable, Identifiable {
    public var id: String
    public var businessId: String
    public var title: String
    public var body: String
    public var discountPct: Int?
    public var serviceIds: [String]
    public var startsAt: Date
    public var endsAt: Date
    public var views: Int
}

public struct Review: Sendable, Hashable, Codable, Identifiable {
    public var id: String
    public var businessId: String
    /// A product or service id.
    public var targetId: String
    public var authorId: String
    public var stars: Int
    public var text: String
    public var tags: [String]
    public var variantName: String?
    public var verified: Bool
    public var reply: String?
    public var at: Date
}

/// `Notification` in the domain model; renamed so it never shadows `Foundation.Notification`.
public struct AppNotification: Sendable, Hashable, Codable, Identifiable {
    public var id: String
    public var userId: String
    public var text: String
    /// An in-app route, e.g. `shop/happy-coffee`, `cart`, `orders`.
    public var route: String
    public var unread: Bool
    public var at: Date
}
