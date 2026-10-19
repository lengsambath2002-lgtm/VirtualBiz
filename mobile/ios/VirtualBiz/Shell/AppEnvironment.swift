import Foundation
import VBizData

/// The repositories the app runs on, built once at launch and handed down.
struct AppEnvironment: Sendable {
    let catalog: any CatalogRepository
    let marketplace: any MarketplaceRepository
    let orders: any OrdersRepository
    let bookings: any BookingsRepository
    let auth: any AuthRepository

    static func mock() -> AppEnvironment {
        AppEnvironment(
            catalog: MockCatalogRepository(),
            marketplace: MockMarketplaceRepository(),
            orders: MockOrdersRepository(),
            bookings: MockBookingsRepository(),
            auth: MockAuthRepository()
        )
    }
}
