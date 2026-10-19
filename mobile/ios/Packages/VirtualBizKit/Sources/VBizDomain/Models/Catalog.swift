import Foundation

public struct ProductOption: Sendable, Hashable, Codable {
    public var name: String
    public var values: [String]

    public init(name: String, values: [String]) {
        self.name = name
        self.values = values
    }
}

public struct Product: Sendable, Hashable, Codable, Identifiable {
    public var id: String
    public var businessId: String
    public var title: String
    public var description: String
    public var categoryId: String
    public var status: ProductStatus
    public var options: [ProductOption]
    public var variants: [Variant]
    public var photos: [URL]
    public var lowStockAt: Int
    public var sold: Int
    public var rating: Double

    /// The cheapest variant — what a product card shows as "from".
    public var leadVariant: Variant? { variants.min { $0.price < $1.price } }
    public var totalStock: Int { variants.reduce(0) { $0 + $1.stock } }
    public var isSoldOut: Bool { totalStock == 0 }
}

public struct Variant: Sendable, Hashable, Codable, Identifiable {
    public var id: String
    public var productId: String
    /// `{"Colour": "Blue", "Storage": "256 GB"}`; empty for a product with no options.
    public var options: [String: String]
    /// The selling price (already net of any shop discount).
    public var price: Money
    /// The struck-through "was" price, when on sale.
    public var compareAt: Money?
    public var cost: Money?
    public var sku: String
    public var barcode: String
    public var stock: Int
    /// `#RRGGBB` swatch for colour options.
    public var swatch: String?

    /// `Blue / 256 GB`, in the product's option order.
    public func name(optionOrder: [ProductOption]) -> String {
        optionOrder.compactMap { options[$0.name] }.joined(separator: " / ")
    }

    public var discountPercent: Int? { Pricing.discountPercent(price: price, compareAt: compareAt) }
}

public struct Service: Sendable, Hashable, Codable, Identifiable {
    public var id: String
    public var businessId: String
    public var name: String
    /// The shop's own grouping ("Hair", "Nails").
    public var category: String
    public var durationMin: Int
    public var price: Money
    public var staffIds: [String]
    public var bookableOnline: Bool
    public var discountPct: Int?

    /// The price the customer pays after `discountPct`.
    public var netPrice: Money { Pricing.netPrice(price, discountPct: discountPct) }
}

public struct StockMovement: Sendable, Hashable, Codable, Identifiable {
    public var id: String
    public var variantId: String
    public var delta: Int
    public var reason: StockReason
    public var byUserId: String
    public var note: String?
    public var at: Date
}
