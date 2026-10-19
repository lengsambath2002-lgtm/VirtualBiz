import Foundation
import Testing
@testable import VBizData
@testable import VBizDomain

private func load() throws -> MockData { try MockData.load() }

@Test("every mock JSON file decodes into the domain models")
func mockDecodes() throws {
    let data = try load()
    #expect(data.districts.count == 10)
    #expect(data.categories.count == 8)
    #expect(data.marketplace.businesses.count == 8)
    #expect(data.marketplace.products.count + data.marketplace.services.count == 22)
    #expect(data.seller.business.name == "Nita Gadget Store")
    #expect(data.seller.products.count == 8)
    #expect(data.provider.members.map(\.name) == ["Try Dana", "Srey Leak", "Vicheka Sok"])
    #expect(data.provider.services.count == 8)
    #expect(Set(data.customer.users.map(\.name)).isSuperset(of: ["Kry Sonita", "Dom Chheng"]))
}

@Test("the district seed is Create Business's ten (open question #10)")
func districtSeed() throws {
    let names = try load().districts.map(\.name)
    #expect(names.sorted() == ["BKK1", "Chamkar Mon", "Chbar Ampov", "Daun Penh", "Mean Chey", "Por Senchey",
                               "Prampi Makara", "Russey Keo", "Sen Sok", "Toul Kork"])
}

@Test("references resolve: districts, categories, businesses, variants, staff")
func referencesResolve() throws {
    let data = try load()
    let districts = Set(data.districts.map(\.id))
    let categories = Set(data.categories.map(\.id))
    let businesses = data.marketplace.businesses + [data.seller.business]
    for business in businesses {
        #expect(districts.contains(business.district), "\(business.id) district")
        #expect(categories.contains(business.categoryId), "\(business.id) category")
        #expect(business.hours.count == 7)
        #expect(PhoneNumber.isValid(business.phone), "\(business.id) phone")
        #expect((business.type == .product) == (business.productSettings != nil))
        #expect((business.type == .service) == (business.bookingSettings != nil))
        for zone in business.productSettings?.zones ?? [] {
            #expect(zone.districts.allSatisfy(districts.contains))
        }
    }
    let businessIds = Set(businesses.map(\.id))
    for product in data.marketplace.products + data.seller.products {
        #expect(businessIds.contains(product.businessId))
        #expect(!product.variants.isEmpty)
        #expect(product.variants.allSatisfy { $0.productId == product.id })
        #expect(product.variants.allSatisfy { Set($0.options.keys) == Set(product.options.map(\.name)) })
    }
    let staffIds = Set((data.marketplace.members + data.provider.members).map(\.id))
    for service in data.marketplace.services + data.provider.services {
        #expect(service.staffIds.allSatisfy(staffIds.contains), "\(service.id) staff")
    }
    let sellerVariants = Set(data.seller.products.flatMap(\.variants).map(\.id))
    for order in data.seller.orders {
        #expect(order.lines.allSatisfy { sellerVariants.contains($0.variantId) })
    }
}

@Test("display numbers follow VB-xxxxx and BK-xxxxx (open question #9)")
func mockDisplayNumbers() throws {
    let data = try load()
    for order in data.customer.orders + data.seller.orders {
        #expect(DisplayNumber.order.sequence(of: order.number) != nil, "\(order.number)")
    }
    for appointment in data.customer.appointments + data.provider.appointments {
        #expect(DisplayNumber.booking.sequence(of: appointment.number) != nil, "\(appointment.number)")
    }
}

@Test("seller orders are internally consistent: totals, zone fees and timelines")
func sellerOrdersConsistent() throws {
    let data = try load()
    guard let settings = data.seller.business.productSettings else {
        Issue.record("seller has no product settings")
        return
    }
    for order in data.seller.orders + data.customer.orders {
        #expect(Pricing.subtotal(order.lines) == order.subtotal, "\(order.number) subtotal")
        #expect(order.subtotal - order.discount + order.deliveryFee == order.total, "\(order.number) total")
        #expect(order.timeline.first?.status == .new)
        #expect(order.timeline.last?.status == order.status, "\(order.number) timeline")
        if order.businessId == data.seller.business.id {
            let quote = DeliveryFee.quote(method: order.method, subtotal: order.subtotal,
                                          district: order.address?.district, settings: settings)
            #expect(quote == .fee(order.deliveryFee), "\(order.number) fee")
        }
    }
}

@Test("Glow Beauty's services are the same records on the marketplace and in the provider app")
func sharedServicesMatch() throws {
    let data = try load()
    let provider = Dictionary(uniqueKeysWithValues: data.provider.services.map { ($0.id, $0) })
    let shared = data.marketplace.services.filter { $0.businessId == data.provider.businessId }
    #expect(shared.count == 3)
    for service in shared { #expect(provider[service.id] == service) }
}

@Test("mock repositories serve the data and enforce the state machines")
func repositories() async throws {
    let data = try load()
    let market = MockMarketplaceRepository(data: data)
    #expect(try await market.businesses(type: .service).count == 4)
    #expect(try await market.promotion(code: " waterfest ")?.maxDiscount == Money(5))
    #expect(try await market.search("coffee").businesses.map(\.id) == ["happy-coffee"])

    let orders = MockOrdersRepository(data: data)
    let queue = try await orders.businessOrders(businessId: "nita-gadget")
    guard let fresh = queue.first(where: { $0.status == .new && $0.method == .delivery }) else {
        Issue.record("no NEW delivery order in the seller mock")
        return
    }
    let accepted = try await orders.updateStatus(orderId: fresh.id, to: .accepted, reason: nil)
    #expect(accepted.timeline.last?.status == .accepted)
    await #expect(throws: RepositoryError.self) {
        try await orders.updateStatus(orderId: fresh.id, to: .delivered, reason: nil)
    }
    #expect(try await orders.customerOrders(customerId: "u-sonita").map(\.number) == ["VB-24038"])

    let bookings = MockBookingsRepository(data: data)
    let today = try await bookings.businessAppointments(businessId: "glow-beauty", date: "2026-10-09")
    #expect(!today.isEmpty)
    guard let request = today.first(where: { $0.status == .requested }) else {
        Issue.record("no REQUESTED appointment today")
        return
    }
    #expect(try await bookings.updateStatus(appointmentId: request.id, to: .booked).status == .booked)
    #expect(try await bookings.customerAppointments(clientId: "u-sonita").first?.number == "BK-02201")
}

@Test("mock sign-in: demo accounts by email or any phone spelling; 5 failures lock for 30 s")
func mockAuth() async throws {
    let data = try load()
    let auth = MockAuthRepository(data: data, clock: { MockData.referenceNow })
    #expect(try await auth.signIn(identifier: "nita@virtualbiz.com", password: MockData.demoPassword).name == "Kry Sonita")
    #expect(try await auth.signIn(identifier: "+855 12 345 678", password: MockData.demoPassword).name == "Dom Chheng")
    #expect(await auth.currentUser()?.name == "Dom Chheng")
    for _ in 0..<MockAuthRepository.maxAttempts {
        await #expect(throws: RepositoryError.invalidCredentials) {
            try await auth.signIn(identifier: "dom@virtualbiz.com", password: "wrong")
        }
    }
    await #expect(throws: RepositoryError.locked(retryAfterSeconds: 30)) {
        try await auth.signIn(identifier: "dom@virtualbiz.com", password: MockData.demoPassword)
    }
}
