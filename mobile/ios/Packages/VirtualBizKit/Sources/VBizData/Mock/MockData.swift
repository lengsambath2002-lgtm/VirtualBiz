import Foundation
import VBizDomain

/// The prototype's mock data, decoded from the JSON files in `Resources/Mock`.
///
/// Ported from the prototype artifacts (customer / seller / provider / sign-in) with the open
/// question resolutions applied: one district table, `VB-xxxxx` / `BK-xxxxx` numbers, the seller's
/// order enum, the provider's appointment enum, zone-based delivery fees. The clock is fixed at
/// `MockData.referenceNow` (2026-10-09 12:30 Phnom Penh) so statuses and dates stay coherent.
public struct MockData: Sendable {
    public struct Marketplace: Codable, Sendable {
        public var businesses: [Business]
        public var members: [BusinessMember]
        public var products: [Product]
        public var services: [Service]
        public var deals: [Deal]
        public var promotions: [Promotion]
    }

    public struct Customer: Codable, Sendable {
        public var users: [User]
        public var addresses: [Address]
        public var orders: [Order]
        public var appointments: [Appointment]
        public var notifications: [AppNotification]
    }

    public struct Seller: Codable, Sendable {
        public var business: Business
        public var members: [BusinessMember]
        public var products: [Product]
        public var clients: [Client]
        public var orders: [Order]
        public var promotions: [Promotion]
    }

    public struct Provider: Codable, Sendable {
        public var businessId: String
        public var members: [BusinessMember]
        public var services: [Service]
        public var clients: [Client]
        public var appointments: [Appointment]
        public var blocks: [Block]
        public var deals: [Deal]
    }

    /// The instant the mock data was written against.
    public static let referenceNow = Date(timeIntervalSince1970: 1_791_523_800) // 2026-10-09T05:30:00Z

    /// The prototype's demo password for every mock account.
    public static let demoPassword = "Demo@1234"

    public var districts: [District]
    public var categories: [BusinessCategory]
    public var marketplace: Marketplace
    public var customer: Customer
    public var seller: Seller
    public var provider: Provider

    public static func load() throws -> MockData { try load(bundle: .module) }

    public static func load(bundle: Bundle) throws -> MockData {
        MockData(
            districts: try decode([District].self, "districts", bundle: bundle),
            categories: try decode([BusinessCategory].self, "categories", bundle: bundle),
            marketplace: try decode(Marketplace.self, "marketplace", bundle: bundle),
            customer: try decode(Customer.self, "customer", bundle: bundle),
            seller: try decode(Seller.self, "seller", bundle: bundle),
            provider: try decode(Provider.self, "provider", bundle: bundle)
        )
    }

    /// Loads once per process; the JSON is small and immutable.
    public static let shared: MockData? = try? load()

    public static func decode<T: Decodable>(_ type: T.Type, _ name: String, bundle: Bundle) throws -> T {
        guard let url = bundle.url(forResource: name, withExtension: "json", subdirectory: "Mock")
            ?? bundle.url(forResource: name, withExtension: "json") else {
            throw RepositoryError.notFound("Mock/\(name).json")
        }
        return try makeDecoder().decode(T.self, from: Data(contentsOf: url))
    }

    public static func makeDecoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }
}
