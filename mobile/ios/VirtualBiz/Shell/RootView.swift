import SwiftUI
import VBizData
import VBizDesignSystem
import VBizDomain

/// The customer shell: Home · Explore · Deals · Cart · Account.
///
/// Phase 1 placeholder — each tab shows design-system components over mock data so the shell,
/// the tokens and the data layer can be seen working together. The real screens live in
/// `Features/` and replace these tabs one by one.
struct RootView: View {
    enum Tab: Hashable { case home, explore, deals, cart, account }

    @State private var model: RootModel
    @State private var selection: Tab = .home

    init(environment: AppEnvironment) {
        _model = State(initialValue: RootModel(environment: environment))
    }

    var body: some View {
        TabView(selection: $selection) {
            HomePlaceholder(model: model)
                .tabItem { Label("tab.home", systemImage: "house") }
                .tag(Tab.home)
            ExplorePlaceholder(model: model)
                .tabItem { Label("tab.explore", systemImage: "magnifyingglass") }
                .tag(Tab.explore)
            DealsPlaceholder(model: model)
                .tabItem { Label("tab.deals", systemImage: "tag") }
                .tag(Tab.deals)
            CartPlaceholder { selection = .home }
                .tabItem { Label("tab.cart", systemImage: "cart") }
                .tag(Tab.cart)
            AccountPlaceholder(model: model)
                .tabItem { Label("tab.account", systemImage: "person.crop.circle") }
                .tag(Tab.account)
        }
        .task { await model.load() }
    }
}

/// Loads what the placeholder tabs show. `@MainActor` + Observation, like every view model.
@MainActor
@Observable
final class RootModel {
    private let environment: AppEnvironment

    private(set) var categories: [BusinessCategory] = []
    private(set) var businesses: [Business] = []
    private(set) var featured: [Product] = []
    private(set) var deals: [Deal] = []
    private(set) var user: User?
    private(set) var lastOrder: Order?
    private(set) var loadFailed = false

    init(environment: AppEnvironment) {
        self.environment = environment
    }

    func load() async {
        do {
            categories = try await environment.catalog.categories()
            businesses = try await environment.marketplace.businesses(type: nil)
            featured = Array(try await environment.marketplace.products(businessId: nil).prefix(Self.featuredCount))
            deals = try await environment.marketplace.deals()
        } catch {
            loadFailed = true
        }
    }

    func signInDemo() async {
        do {
            let signedIn = try await environment.auth.signIn(identifier: Self.demoEmail, password: MockData.demoPassword)
            user = signedIn
            lastOrder = try await environment.orders.customerOrders(customerId: signedIn.id).first
        } catch {
            user = nil
        }
    }

    func signOut() async {
        await environment.auth.signOut()
        user = nil
        lastOrder = nil
    }

    private static let featuredCount = 6
    private static let demoEmail = "nita@virtualbiz.com"
}

// MARK: - Tabs (placeholders)

private struct HomePlaceholder: View {
    let model: RootModel

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: VBiz.Spacing.lg) {
                    Text("home.title")
                        .font(VBiz.Typography.largeTitle)
                        .foregroundStyle(VBiz.Palette.ink)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: VBiz.Spacing.xs) {
                            ForEach(model.categories) { category in
                                Chip(category.name, systemImage: VBizIcon.symbol(for: category.icon)) {}
                            }
                        }
                    }
                    SectionTitle("home.featured")
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: VBiz.Spacing.sm) {
                        ForEach(model.featured) { product in
                            ProductTile(product: product)
                        }
                    }
                    SectionTitle("home.nearby")
                    ForEach(model.businesses.prefix(4)) { business in
                        BusinessRow(business: business)
                    }
                }
                .padding(.horizontal, VBiz.Spacing.gutter)
                .padding(.bottom, VBiz.Spacing.xl)
            }
            .background(GlassWallpaper())
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Logo(markSize: 28) }
            }
        }
    }
}

private struct ExplorePlaceholder: View {
    let model: RootModel

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: VBiz.Spacing.sm) {
                    SectionTitle("explore.categories")
                    ForEach(model.categories) { category in
                        let tint = VBiz.Swatch.tint(category.tint)
                        GlassCard {
                            HStack(spacing: VBiz.Spacing.sm) {
                                Image(systemName: VBizIcon.symbol(for: category.icon))
                                    .foregroundStyle(Color(tint.ink))
                                    .frame(width: VBiz.Size.minTap, height: VBiz.Size.minTap)
                                    .background(Color(tint.background), in: RoundedRectangle(cornerRadius: VBiz.Radius.small))
                                Text(category.name).font(VBiz.Typography.headline)
                            }
                        }
                    }
                }
                .padding(.horizontal, VBiz.Spacing.gutter)
            }
            .background(GlassWallpaper())
            .navigationTitle("tab.explore")
        }
    }
}

private struct DealsPlaceholder: View {
    let model: RootModel

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: VBiz.Spacing.sm) {
                    ForEach(model.deals) { deal in
                        GlassCard {
                            VStack(alignment: .leading, spacing: VBiz.Spacing.xs) {
                                Text(deal.title).font(VBiz.Typography.headline)
                                Text(deal.body).font(VBiz.Typography.callout).foregroundStyle(VBiz.Palette.muted)
                                Text("deals.endsOn \(deal.endsAt.formatted(date: .abbreviated, time: .omitted))")
                                    .font(VBiz.Typography.caption)
                                    .foregroundStyle(VBiz.Palette.accentInk)
                            }
                        }
                    }
                }
                .padding(.horizontal, VBiz.Spacing.gutter)
            }
            .background(GlassWallpaper())
            .navigationTitle("tab.deals")
        }
    }
}

private struct CartPlaceholder: View {
    let onBrowse: () -> Void

    var body: some View {
        NavigationStack {
            VStack(spacing: VBiz.Spacing.md) {
                Spacer()
                Image(systemName: "cart").font(.system(size: 48)).foregroundStyle(VBiz.Palette.muted)
                Text("cart.empty.title").font(VBiz.Typography.title)
                Text("cart.empty.body")
                    .font(VBiz.Typography.callout)
                    .foregroundStyle(VBiz.Palette.muted)
                    .multilineTextAlignment(.center)
                AccentButton("cart.browse", systemImage: "bag", action: onBrowse)
                Spacer()
            }
            .padding(.horizontal, VBiz.Spacing.gutter)
            .frame(maxWidth: .infinity)
            .background(GlassWallpaper())
            .navigationTitle("tab.cart")
        }
    }
}

private struct AccountPlaceholder: View {
    let model: RootModel

    var body: some View {
        NavigationStack {
            VStack(spacing: VBiz.Spacing.md) {
                Logo(.markOnly, markSize: 64)
                if let user = model.user {
                    Text("account.signedInAs \(user.name)").font(VBiz.Typography.headline)
                    if let order = model.lastOrder {
                        GlassCard {
                            HStack {
                                Text(order.number).font(VBiz.Typography.label)
                                Spacer()
                                Text(LocalizedStringKey(order.status.customerLabelKey(method: order.method)))
                                    .font(VBiz.Typography.caption)
                                    .foregroundStyle(VBiz.Palette.ok)
                            }
                        }
                    }
                    Button("account.signOut") { Task { await model.signOut() } }
                        .buttonStyle(CapsuleButtonStyle(.secondary))
                } else {
                    Text("account.demoHint").font(VBiz.Typography.callout).foregroundStyle(VBiz.Palette.muted)
                    PrimaryButton("account.signIn") { Task { await model.signInDemo() } }
                }
            }
            .padding(.horizontal, VBiz.Spacing.gutter)
            .frame(maxHeight: .infinity)
            .background(GlassWallpaper())
            .navigationTitle("tab.account")
        }
    }
}

// MARK: - Shared bits

private struct SectionTitle: View {
    let key: LocalizedStringKey

    init(_ key: LocalizedStringKey) { self.key = key }

    var body: some View {
        Text(key).font(VBiz.Typography.headline).foregroundStyle(VBiz.Palette.ink)
    }
}

private struct ProductTile: View {
    let product: Product

    var body: some View {
        GlassCard(padding: VBiz.Spacing.sm) {
            VStack(alignment: .leading, spacing: VBiz.Spacing.xs) {
                Text(product.title)
                    .font(VBiz.Typography.label)
                    .lineLimit(2, reservesSpace: true)
                if let lead = product.leadVariant {
                    PriceLabel(lead.price, compareAt: lead.compareAt)
                }
            }
        }
    }
}

private struct BusinessRow: View {
    let business: Business

    var body: some View {
        GlassCard {
            HStack(spacing: VBiz.Spacing.sm) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(business.name).font(VBiz.Typography.headline)
                    Text(business.street).font(VBiz.Typography.caption).foregroundStyle(VBiz.Palette.muted)
                }
                Spacer()
                Label(business.rating.formatted(.number.precision(.fractionLength(1))), systemImage: "star.fill")
                    .font(VBiz.Typography.caption)
                    .foregroundStyle(VBiz.Palette.accentInk)
            }
        }
    }
}

#Preview {
    RootView(environment: .mock())
}
