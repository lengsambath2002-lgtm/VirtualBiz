import Foundation

public struct User: Sendable, Hashable, Codable, Identifiable {
    public var id: String
    public var name: String
    public var email: String?
    /// Normalized `0XXXXXXXX` (see `PhoneNumber`).
    public var phone: String?
    public var avatarUrl: URL?
    public var signInMethods: [SignInMethod]
    public var createdAt: Date

    public init(id: String, name: String, email: String? = nil, phone: String? = nil, avatarUrl: URL? = nil,
                signInMethods: [SignInMethod], createdAt: Date) {
        self.id = id
        self.name = name
        self.email = email
        self.phone = phone
        self.avatarUrl = avatarUrl
        self.signInMethods = signInMethods
        self.createdAt = createdAt
    }

    public var firstName: String { name.split(separator: " ").first.map(String.init) ?? name }
}

public struct Address: Sendable, Hashable, Codable, Identifiable {
    public var id: String
    public var userId: String
    public var label: AddressLabel
    public var name: String
    public var phone: String
    public var line: String
    /// A `District.id`.
    public var district: String
    public var note: String?
    public var isDefault: Bool

    public init(id: String, userId: String, label: AddressLabel, name: String, phone: String, line: String,
                district: String, note: String? = nil, isDefault: Bool) {
        self.id = id
        self.userId = userId
        self.label = label
        self.name = name
        self.phone = phone
        self.line = line
        self.district = district
        self.note = note
        self.isDefault = isDefault
    }
}

/// The `meta.district` table (open question #10). `km` is the distance from the city centre, used
/// only for "nearest first" sorting.
public struct District: Sendable, Hashable, Codable, Identifiable {
    public var id: String
    public var name: String
    public var km: Double

    public init(id: String, name: String, km: Double) {
        self.id = id
        self.name = name
        self.km = km
    }
}

/// `Category` in the domain model: a platform (marketplace) category. Renamed because `Category`
/// collides with the Objective-C runtime typedef on Apple platforms. Shop-defined collections are
/// a separate, later concept (open question #11).
public struct BusinessCategory: Sendable, Hashable, Codable, Identifiable {
    public var id: String
    public var name: String
    /// A design-system icon key (`cup`, `phone`, `leaf`, …).
    public var icon: String
    /// The prototype's tint slot, 1–6.
    public var tint: Int
    public var businessType: BusinessType

    public init(id: String, name: String, icon: String, tint: Int, businessType: BusinessType) {
        self.id = id
        self.name = name
        self.icon = icon
        self.tint = tint
        self.businessType = businessType
    }
}
