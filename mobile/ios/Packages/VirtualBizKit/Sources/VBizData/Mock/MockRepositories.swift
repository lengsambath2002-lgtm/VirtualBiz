import Foundation
import VBizDomain

// In-memory repositories over `MockData`. Actors, so the mutations (status changes, sign-in)
// are race-free under Swift 6 strict concurrency. Each one starts from a fresh copy of the data.

private func loadShared() -> MockData {
    if let shared = MockData.shared { return shared }
    preconditionFailure("VBizData mock JSON failed to decode — run `swift test` for the decoding error")
}

// MARK: - Catalog

public actor MockCatalogRepository: CatalogRepository {
    private let data: MockData

    public init(data: MockData? = nil) { self.data = data ?? loadShared() }

    public func districts() async throws -> [District] { data.districts }
    public func categories() async throws -> [BusinessCategory] { data.categories }
}

// MARK: - Marketplace

public actor MockMarketplaceRepository: MarketplaceRepository {
    private let market: MockData.Marketplace

    public init(data: MockData? = nil) { market = (data ?? loadShared()).marketplace }

    public func businesses(type: BusinessType?) async throws -> [Business] {
        guard let type else { return market.businesses }
        return market.businesses.filter { $0.type == type }
    }

    public func business(id: String) async throws -> Business {
        guard let found = market.businesses.first(where: { $0.id == id }) else { throw RepositoryError.notFound(id) }
        return found
    }

    public func products(businessId: String?) async throws -> [Product] {
        market.products.filter { businessId == nil || $0.businessId == businessId }
    }

    public func product(id: String) async throws -> Product {
        guard let found = market.products.first(where: { $0.id == id }) else { throw RepositoryError.notFound(id) }
        return found
    }

    public func services(businessId: String?) async throws -> [Service] {
        market.services.filter { businessId == nil || $0.businessId == businessId }
    }

    public func staff(businessId: String) async throws -> [BusinessMember] {
        market.members.filter { $0.businessId == businessId && $0.active }
    }

    public func deals() async throws -> [Deal] { market.deals }

    public func promotion(code: String) async throws -> Promotion? {
        let wanted = code.trimmingCharacters(in: .whitespaces).uppercased()
        return market.promotions.first { $0.businessId == nil && $0.code?.uppercased() == wanted }
    }

    public func search(_ query: String) async throws -> MarketplaceSearchResult {
        let needle = query.trimmingCharacters(in: .whitespaces)
        guard !needle.isEmpty else { return MarketplaceSearchResult(businesses: [], products: [], services: []) }
        func matches(_ text: String) -> Bool { text.localizedCaseInsensitiveContains(needle) }
        return MarketplaceSearchResult(
            businesses: market.businesses.filter { matches($0.name) || matches($0.about ?? "") },
            products: market.products.filter { matches($0.title) },
            services: market.services.filter { matches($0.name) || matches($0.category) }
        )
    }
}

// MARK: - Orders

public actor MockOrdersRepository: OrdersRepository {
    private var orders: [Order]
    private let seller: MockData.Seller
    private let clock: @Sendable () -> Date

    public init(data: MockData? = nil, clock: @escaping @Sendable () -> Date = { MockData.referenceNow }) {
        let source = data ?? loadShared()
        orders = source.customer.orders + source.seller.orders
        seller = source.seller
        self.clock = clock
    }

    public func customerOrders(customerId: String) async throws -> [Order] {
        orders.filter { $0.customerId == customerId }.sorted { $0.createdAt > $1.createdAt }
    }

    public func businessOrders(businessId: String) async throws -> [Order] {
        orders.filter { $0.businessId == businessId }.sorted { $0.createdAt > $1.createdAt }
    }

    public func order(id: String) async throws -> Order {
        guard let found = orders.first(where: { $0.id == id }) else { throw RepositoryError.notFound(id) }
        return found
    }

    public func updateStatus(orderId: String, to status: OrderStatus, reason: String?) async throws -> Order {
        guard let index = orders.firstIndex(where: { $0.id == orderId }) else { throw RepositoryError.notFound(orderId) }
        var order = orders[index]
        guard order.status.canTransition(to: status, method: order.method) else {
            throw RepositoryError.invalidTransition(from: order.status.rawValue, to: status.rawValue)
        }
        order.status = status
        order.timeline.append(OrderTimelineEntry(status: status, at: clock()))
        if status == .cancelled { order.cancelReason = reason }
        if status == .delivered || status == .pickedUp, order.payment.channel == .cod { order.payment.paid = true }
        orders[index] = order
        return order
    }

    public func sellerProducts(businessId: String) async throws -> [Product] {
        seller.products.filter { $0.businessId == businessId }
    }

    public func sellerBusiness(id: String) async throws -> Business {
        guard seller.business.id == id else { throw RepositoryError.notFound(id) }
        return seller.business
    }
}

// MARK: - Bookings

public actor MockBookingsRepository: BookingsRepository {
    private var appointments: [Appointment]
    private let provider: MockData.Provider
    private let market: MockData.Marketplace
    private let clock: @Sendable () -> Date

    public init(data: MockData? = nil, clock: @escaping @Sendable () -> Date = { MockData.referenceNow }) {
        let source = data ?? loadShared()
        appointments = source.customer.appointments + source.provider.appointments
        provider = source.provider
        market = source.marketplace
        self.clock = clock
    }

    public func customerAppointments(clientId: String) async throws -> [Appointment] {
        appointments.filter { $0.clientId == clientId }.sorted { ($0.date, $0.start) < ($1.date, $1.start) }
    }

    public func businessAppointments(businessId: String, date: LocalDate?) async throws -> [Appointment] {
        appointments
            .filter { $0.businessId == businessId && (date == nil || $0.date == date) }
            .sorted { ($0.date, $0.start) < ($1.date, $1.start) }
    }

    public func blocks(businessId: String, date: LocalDate) async throws -> [Block] {
        provider.blocks.filter { $0.businessId == businessId && $0.date == date }
    }

    public func clients(businessId: String) async throws -> [Client] {
        provider.clients.filter { $0.businessId == businessId }
    }

    public func services(businessId: String) async throws -> [Service] {
        if businessId == provider.businessId { return provider.services }
        return market.services.filter { $0.businessId == businessId }
    }

    public func staff(businessId: String) async throws -> [BusinessMember] {
        let members = businessId == provider.businessId ? provider.members : market.members
        return members.filter { $0.businessId == businessId }
    }

    public func updateStatus(appointmentId: String, to status: AppointmentStatus) async throws -> Appointment {
        guard let index = appointments.firstIndex(where: { $0.id == appointmentId }) else {
            throw RepositoryError.notFound(appointmentId)
        }
        var appointment = appointments[index]
        guard appointment.status.canTransition(to: status) else {
            throw RepositoryError.invalidTransition(from: appointment.status.rawValue, to: status.rawValue)
        }
        appointment.status = status
        appointment.log.append(AppointmentLogEntry(text: status.rawValue, at: clock()))
        appointments[index] = appointment
        return appointment
    }
}

// MARK: - Auth

/// The sign-in prototype's mock backend: the demo accounts (Kry Sonita, Dom Chheng) with password
/// `Demo@1234`, by email or phone. Five wrong passwords lock sign-in for 30 s.
public actor MockAuthRepository: AuthRepository {
    public static let maxAttempts = 5
    public static let lockSeconds = 30

    private let customer: MockData.Customer
    private let clock: @Sendable () -> Date
    private var signedIn: User?
    private var failures = 0
    private var lockedUntil: Date?

    public init(data: MockData? = nil, signedIn: User? = nil,
                clock: @escaping @Sendable () -> Date = { Date() }) {
        customer = (data ?? loadShared()).customer
        self.signedIn = signedIn
        self.clock = clock
    }

    public func signIn(identifier: String, password: String) async throws -> User {
        let now = clock()
        if let until = lockedUntil, now < until {
            throw RepositoryError.locked(retryAfterSeconds: Int(until.timeIntervalSince(now).rounded(.up)))
        }
        guard let user = findUser(identifier), password == MockData.demoPassword else {
            failures += 1
            if failures >= Self.maxAttempts {
                failures = 0
                lockedUntil = now.addingTimeInterval(TimeInterval(Self.lockSeconds))
            }
            throw RepositoryError.invalidCredentials
        }
        failures = 0
        lockedUntil = nil
        signedIn = user
        return user
    }

    public func currentUser() async -> User? { signedIn }

    public func signOut() async { signedIn = nil }

    public func addresses(userId: String) async throws -> [Address] {
        customer.addresses.filter { $0.userId == userId }
    }

    public func notifications(userId: String) async throws -> [AppNotification] {
        customer.notifications.filter { $0.userId == userId }.sorted { $0.at > $1.at }
    }

    private func findUser(_ identifier: String) -> User? {
        let trimmed = identifier.trimmingCharacters(in: .whitespaces)
        if trimmed.contains("@") {
            return customer.users.first { $0.email?.caseInsensitiveCompare(trimmed) == .orderedSame }
        }
        guard let phone = PhoneNumber(trimmed) else { return nil }
        return customer.users.first { $0.phone == phone.value }
    }
}
