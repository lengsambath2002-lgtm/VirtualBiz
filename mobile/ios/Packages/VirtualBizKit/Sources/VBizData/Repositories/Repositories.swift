import Foundation
import VBizDomain

// The data seams the app's view models depend on. Each has a Mock implementation today (backed by
// the prototype's data) and gets a live one, built on VBizAPI, once the backend endpoint exists.
// All are `Sendable` so a `@MainActor` view model can hold one and `await` it.

public enum RepositoryError: Error, Sendable, Equatable {
    case notFound(String)
    case invalidTransition(from: String, to: String)
    case invalidCredentials
    case locked(retryAfterSeconds: Int)
    case invalidInput(String)
}

/// Platform reference data: districts and marketplace categories.
public protocol CatalogRepository: Sendable {
    func districts() async throws -> [District]
    func categories() async throws -> [BusinessCategory]
}

/// What the customer browses.
public protocol MarketplaceRepository: Sendable {
    func businesses(type: BusinessType?) async throws -> [Business]
    func business(id: String) async throws -> Business
    func products(businessId: String?) async throws -> [Product]
    func product(id: String) async throws -> Product
    func services(businessId: String?) async throws -> [Service]
    func staff(businessId: String) async throws -> [BusinessMember]
    func deals() async throws -> [Deal]
    /// A promo code the customer typed, case-insensitive. Platform-wide codes only.
    func promotion(code: String) async throws -> Promotion?
    func search(_ query: String) async throws -> MarketplaceSearchResult
}

public struct MarketplaceSearchResult: Sendable, Hashable {
    public var businesses: [Business]
    public var products: [Product]
    public var services: [Service]

    public init(businesses: [Business], products: [Product], services: [Service]) {
        self.businesses = businesses
        self.products = products
        self.services = services
    }

    public var isEmpty: Bool { businesses.isEmpty && products.isEmpty && services.isEmpty }
}

/// Orders, from both sides: the customer's history and a seller's queue.
public protocol OrdersRepository: Sendable {
    func customerOrders(customerId: String) async throws -> [Order]
    func businessOrders(businessId: String) async throws -> [Order]
    func order(id: String) async throws -> Order
    /// Moves an order along its state machine; throws `invalidTransition` for a move it forbids.
    func updateStatus(orderId: String, to status: OrderStatus, reason: String?) async throws -> Order
    /// The seller dashboard's own shop, products and customers.
    func sellerProducts(businessId: String) async throws -> [Product]
    func sellerBusiness(id: String) async throws -> Business
}

/// Appointments, from both sides: the customer's bookings and a provider's calendar.
public protocol BookingsRepository: Sendable {
    func customerAppointments(clientId: String) async throws -> [Appointment]
    func businessAppointments(businessId: String, date: LocalDate?) async throws -> [Appointment]
    func blocks(businessId: String, date: LocalDate) async throws -> [Block]
    func clients(businessId: String) async throws -> [Client]
    func services(businessId: String) async throws -> [Service]
    func staff(businessId: String) async throws -> [BusinessMember]
    func updateStatus(appointmentId: String, to status: AppointmentStatus) async throws -> Appointment
}

/// Sign-in and the current session.
public protocol AuthRepository: Sendable {
    /// `identifier` is an email or a phone number in any accepted spelling.
    func signIn(identifier: String, password: String) async throws -> User
    func currentUser() async -> User?
    func signOut() async
    func addresses(userId: String) async throws -> [Address]
    func notifications(userId: String) async throws -> [AppNotification]
}
