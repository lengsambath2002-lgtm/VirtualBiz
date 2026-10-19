package com.kosign.vbiz.marketplace.service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.business.domain.Business;
import com.kosign.vbiz.business.domain.BusinessMember;
import com.kosign.vbiz.business.domain.BusinessType;
import com.kosign.vbiz.business.domain.MemberRole;
import com.kosign.vbiz.business.repository.BusinessRepository;
import com.kosign.vbiz.business.service.MembershipService;
import com.kosign.vbiz.catalog.domain.Product;
import com.kosign.vbiz.catalog.domain.ProductStatus;
import com.kosign.vbiz.catalog.domain.ProductVariant;
import com.kosign.vbiz.catalog.domain.ServiceItem;
import com.kosign.vbiz.catalog.mapper.CatalogMapper;
import com.kosign.vbiz.catalog.repository.ProductRepository;
import com.kosign.vbiz.catalog.repository.ProductVariantRepository;
import com.kosign.vbiz.catalog.repository.ServiceItemRepository;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.marketplace.payload.ListingReviewResponse;
import com.kosign.vbiz.marketplace.payload.MarketDealResponse;
import com.kosign.vbiz.marketplace.payload.MarketItemResponse;
import com.kosign.vbiz.marketplace.payload.MarketProductResponse;
import com.kosign.vbiz.marketplace.payload.MarketServiceResponse;
import com.kosign.vbiz.marketplace.payload.MarketShopResponse;
import com.kosign.vbiz.marketplace.payload.MarketVariantResponse;
import com.kosign.vbiz.marketplace.payload.PromotionResponse;
import com.kosign.vbiz.marketplace.payload.SearchQuery;
import com.kosign.vbiz.marketplace.payload.SearchResultResponse;
import com.kosign.vbiz.marketplace.payload.StaffRef;
import com.kosign.vbiz.marketplace.repository.ListingSearchRepository;
import com.kosign.vbiz.meta.domain.Category;
import com.kosign.vbiz.meta.domain.District;
import com.kosign.vbiz.meta.repository.CategoryRepository;
import com.kosign.vbiz.meta.repository.DistrictRepository;
import com.kosign.vbiz.promotion.domain.Promotion;
import com.kosign.vbiz.promotion.service.PromotionQueryService;
import com.kosign.vbiz.review.domain.Review;
import com.kosign.vbiz.review.domain.ReviewTarget;
import com.kosign.vbiz.review.service.ReviewQueryService;

import lombok.RequiredArgsConstructor;

/**
 * Customer marketplace read models (docs/api/phase2-catalog-inventory.md § Marketplace). The
 * listed catalogue is small, so each request reads one snapshot (a handful of queries) and
 * shapes it; search narrows with SQL first ({@link ListingSearchRepository}).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MarketplaceService {

    private static final BigDecimal LOW_FEE = new BigDecimal("0.75");

    private final BusinessRepository businesses;
    private final ProductRepository products;
    private final ProductVariantRepository variants;
    private final ServiceItemRepository services;
    private final MembershipService membership;
    private final CategoryRepository categories;
    private final DistrictRepository districts;
    private final ReviewQueryService reviews;
    private final PromotionQueryService promotions;
    private final ListingSearchRepository search;
    private final Clock clock;

    /** Where the customer is: an exact point and / or a district. */
    record Origin(Double lat, Double lng, District district) {
    }

    /** Everything listed right now. {@code shops} is in display order (name). */
    record Snapshot(List<Business> shops, Map<UUID, Business> byId, List<Product> products,
            Map<UUID, List<ProductVariant>> variants, List<ServiceItem> services,
            Map<UUID, List<BusinessMember>> members, Map<String, Category> categories,
            Map<String, District> districtsByName) {
    }

    // ── endpoints ────────────────────────────────────────────────────────────────────

    public List<MarketShopResponse> shops(Double lat, Double lng, String district) {
        Snapshot s = snapshot();
        Origin o = origin(lat, lng, district);
        ZonedDateTime now = ZonedDateTime.now(clock);
        return sortByDistance(s.shops().stream().map(b -> shop(b, s, o, now)).toList(), o);
    }

    public MarketShopResponse shop(String slugOrId, Double lat, Double lng, String district) {
        Business b = requireBusiness(slugOrId);
        Snapshot s = snapshot();
        return shop(b, s, origin(lat, lng, district), ZonedDateTime.now(clock));
    }

    public List<MarketItemResponse> items(String shopSlug, String type) {
        Snapshot s = snapshot();
        UUID shopId = shopSlug == null || shopSlug.isBlank() ? null : requireBusiness(shopSlug).getId();
        String kind = kind(type);
        return baseItems(s).stream()
                .filter(i -> shopId == null || i.businessId().equals(shopId))
                .filter(i -> kind == null || i.kind().equals(kind))
                .map(i -> item(i, s)).toList();
    }

    public MarketItemResponse item(String slugOrId) {
        Snapshot s = snapshot();
        return item(requireListed(s, slugOrId), s);
    }

    public List<ListingReviewResponse> itemReviews(String slugOrId) {
        Snapshot s = snapshot();
        Listing l = requireListed(s, slugOrId);
        ReviewTarget t = l.kind().equals("PRODUCT") ? ReviewTarget.PRODUCT : ReviewTarget.SERVICE;
        return reviews.ofTarget(t, l.id()).stream().map(r -> review(r, l.slug())).toList();
    }

    public List<ListingReviewResponse> shopReviews(String slugOrId) {
        Business b = requireBusiness(slugOrId);
        Snapshot s = snapshot();
        Map<UUID, String> slugs = baseItems(s).stream().filter(i -> i.businessId().equals(b.getId()))
                .collect(Collectors.toMap(Listing::id, Listing::slug));
        return reviews.ofBusiness(b.getId()).stream().filter(r -> slugs.containsKey(r.getTargetId()))
                .map(r -> review(r, slugs.get(r.getTargetId()))).toList();
    }

    public List<MarketDealResponse> deals() {
        Map<UUID, Business> byId = businesses.findVisible().stream()
                .collect(Collectors.toMap(Business::getId, Function.identity()));
        return promotions.activeDeals().stream().filter(d -> byId.containsKey(d.getBusinessId()))
                .map(d -> new MarketDealResponse(d.getId().toString(), d.getBusinessId().toString(),
                        byId.get(d.getBusinessId()).getSlug(), d.getTitle(), d.getBody(), d.getDiscountPct(),
                        d.getServiceIds(), d.getStartsAt(), d.getEndsAt()))
                .toList();
    }

    public List<PromotionResponse> platformPromotions() {
        return promotions.activePlatformCodes().stream().map(MarketplaceService::promotion).toList();
    }

    public SearchResultResponse search(SearchQuery q) {
        Snapshot s = snapshot();
        Origin o = origin(q.lat(), q.lng(), q.district());
        ZonedDateTime now = ZonedDateTime.now(clock);
        String type = q.type() == null ? "all" : q.type();
        String kind = kind(type);
        List<String> cats = q.categories() == null ? List.of() : q.categories();

        Set<UUID> hits = search.find(new ListingSearchRepository.Filter(q.q(), kind, cats, q.min(), q.max(),
                q.rating(), q.sale())).stream().map(ListingSearchRepository.Hit::id).collect(Collectors.toSet());
        Map<UUID, Boolean> open = new HashMap<>();
        Map<UUID, Double> dist = new HashMap<>();
        for (Business b : s.shops()) {
            open.put(b.getId(), MarketRules.isOpen(b, now));
            dist.put(b.getId(), distance(b, o, s));
        }
        String district = o.district() == null ? null : o.district().getName();
        List<Listing> items = baseItems(s).stream()
                .filter(i -> hits.contains(i.id()))
                .filter(i -> !q.open() || open.getOrDefault(i.businessId(), false))
                .filter(i -> !q.freeDel() || district == null || (i.kind().equals("PRODUCT")
                        && MarketRules.zoneFee(s.byId().get(i.businessId()).getProductSettings(), district)
                                .compareTo(LOW_FEE) <= 0))
                .collect(Collectors.toCollection(ArrayList::new));
        Comparator<Listing> nearest = Comparator.comparing(i -> dist.get(i.businessId()),
                Comparator.nullsLast(Comparator.naturalOrder()));
        Comparator<Listing> order = switch (q.sort() == null ? "best" : q.sort()) {
            case "low" -> Comparator.comparing(Listing::net);
            case "high" -> Comparator.comparing(Listing::net).reversed();
            case "rating" -> Comparator.comparing(Listing::rating).reversed();
            case "near" -> nearest;
            default -> Comparator.comparingDouble((Listing i) -> i.sold() * i.rating().doubleValue()).reversed();
        };
        items.sort(order);

        String text = q.q() == null ? "" : q.q().trim().toLowerCase(Locale.ROOT);
        List<MarketShopResponse> shops = s.shops().stream()
                .filter(b -> text.isEmpty() || shopText(b, s).contains(text))
                .filter(b -> cats.isEmpty() || cats.contains(b.getCategoryId()))
                .filter(b -> !q.open() || open.get(b.getId()))
                .filter(b -> q.rating() == null || b.getRating().doubleValue() >= q.rating())
                .filter(b -> kind == null || b.getType().name().equals(kind))
                .map(b -> shop(b, s, o, now)).toList();
        return new SearchResultResponse(items.stream().map(i -> item(i, s)).toList(), sortByDistance(shops, o));
    }

    // ── snapshot & shaping ───────────────────────────────────────────────────────────

    /** A listed product or service with what sorting needs. */
    record Listing(String kind, UUID id, String slug, UUID businessId, BigDecimal net, BigDecimal rating,
            int sold, Product product, ServiceItem service) {
    }

    Snapshot snapshot() {
        List<Business> visible = businesses.findVisible();
        List<UUID> ids = visible.stream().map(Business::getId).toList();
        List<Product> ps = ids.isEmpty() ? List.of() : products.findListed(ids, ProductStatus.ACTIVE);
        Map<UUID, List<ProductVariant>> vs = ps.isEmpty() ? Map.of()
                : variants.findLiveByProductIds(ps.stream().map(Product::getId).toList()).stream()
                        .collect(Collectors.groupingBy(ProductVariant::getProductId));
        ps = ps.stream().filter(p -> vs.containsKey(p.getId())).toList();
        List<ServiceItem> ss = ids.isEmpty() ? List.of() : services.findListed(ids);
        Set<UUID> withListings = new HashSet<>();
        ps.forEach(p -> withListings.add(p.getBusinessId()));
        ss.forEach(x -> withListings.add(x.getBusinessId()));
        List<Business> listed = visible.stream().filter(b -> withListings.contains(b.getId())).toList();
        Map<UUID, Business> byId = visible.stream().collect(Collectors.toMap(Business::getId, Function.identity()));
        Map<UUID, List<BusinessMember>> members = membership.activeMembers(withListings).stream()
                .sorted(Comparator.comparing((BusinessMember m) -> roleRank(m.getRole()))
                        .thenComparing(BusinessMember::getCreatedAt).thenComparing(BusinessMember::getId))
                .collect(Collectors.groupingBy(BusinessMember::getBusinessId, LinkedHashMap::new,
                        Collectors.toList()));
        Map<String, Category> cats = categories.findAll().stream()
                .collect(Collectors.toMap(Category::getId, Function.identity()));
        Map<String, District> ds = districts.findAll().stream()
                .collect(Collectors.toMap(District::getName, Function.identity()));
        return new Snapshot(listed, byId, ps, vs, ss, members, cats, ds);
    }

    /** Listings in display order: shop order, then products, then services, by position. */
    List<Listing> baseItems(Snapshot s) {
        Map<UUID, Integer> shopOrder = new HashMap<>();
        for (int i = 0; i < s.shops().size(); i++) {
            shopOrder.put(s.shops().get(i).getId(), i);
        }
        List<Listing> out = new ArrayList<>();
        for (Product p : s.products()) {
            ProductVariant v0 = s.variants().get(p.getId()).get(0);
            out.add(new Listing("PRODUCT", p.getId(), p.getSlug(), p.getBusinessId(), v0.getPrice(), p.getRating(),
                    p.getSoldCount(), p, null));
        }
        for (ServiceItem x : s.services()) {
            out.add(new Listing("SERVICE", x.getId(), x.getSlug(), x.getBusinessId(),
                    MarketRules.discounted(x.getPrice(), x.getDiscountPct()), x.getRating(), x.getSoldCount(), null, x));
        }
        out.removeIf(l -> !shopOrder.containsKey(l.businessId()));
        out.sort(Comparator.comparing((Listing l) -> shopOrder.get(l.businessId()))
                .thenComparing(l -> l.kind().equals("PRODUCT") ? 0 : 1)
                .thenComparing(l -> l.product() != null ? l.product().getPosition() : l.service().getPosition()));
        return out;
    }

    private MarketItemResponse item(Listing l, Snapshot s) {
        String shopSlug = s.byId().get(l.businessId()).getSlug();
        if (l.product() != null) {
            Product p = l.product();
            List<MarketVariantResponse> vs = s.variants().get(p.getId()).stream()
                    .map(v -> new MarketVariantResponse(v.getId().toString(), p.getId().toString(),
                            CatalogMapper.optionMap(p.getOptions(), v.getOptionValues()), v.getPrice(),
                            v.getCompareAt(), v.getSku(), v.getStock(), v.getSwatch()))
                    .toList();
            return new MarketProductResponse("PRODUCT", p.getId().toString(), p.getSlug(),
                    p.getBusinessId().toString(), shopSlug, p.getTitle(), p.getDescription(), p.getCategoryId(),
                    p.getOptions(), vs, p.getPhotos(), CatalogMapper.specMap(p.getSpecs()), p.getSoldCount(),
                    p.getRating().doubleValue());
        }
        ServiceItem x = l.service();
        return new MarketServiceResponse("SERVICE", x.getId().toString(), x.getSlug(),
                x.getBusinessId().toString(), shopSlug, x.getName(), x.getCategory(), x.getDescription(),
                x.getDurationMin(), x.getPrice(), x.getDiscountPct(),
                staffOrder(x, s), x.getSoldCount(), x.getRating().doubleValue());
    }

    /** A service's staff ids in the shop's member order. */
    private static List<String> staffOrder(ServiceItem x, Snapshot s) {
        List<BusinessMember> ms = s.members().getOrDefault(x.getBusinessId(), List.of());
        return ms.stream().filter(m -> x.getStaffIds().contains(m.getId())).map(m -> m.getId().toString()).toList();
    }

    private MarketShopResponse shop(Business b, Snapshot s, Origin o, ZonedDateTime now) {
        Category c = s.categories().get(b.getCategoryId());
        Set<UUID> performing = new HashSet<>();
        s.services().stream().filter(x -> x.getBusinessId().equals(b.getId()))
                .forEach(x -> performing.addAll(x.getStaffIds()));
        List<BusinessMember> ms = s.members().containsKey(b.getId()) ? s.members().get(b.getId())
                : membership.members(b.getId()).stream().filter(BusinessMember::isActive).toList();
        List<StaffRef> staff = ms.stream().filter(m -> performing.contains(m.getId()))
                .map(m -> new StaffRef(m.getId().toString(), m.getName(), m.getTitle(), m.getColor())).toList();
        List<Integer> eta = b.getEtaMin() == null ? null : List.of(b.getEtaMin(), b.getEtaMax());
        return new MarketShopResponse(b.getId().toString(), b.getSlug(), b.getType(), b.getName(),
                b.getCategoryId(), c == null ? "store" : c.getIcon(), c == null ? 1 : c.getTint(),
                b.getAbout() == null ? "" : b.getAbout(), b.getLogoUrl(), b.getCoverUrl(), b.getPhone(), b.getDistrict(), b.getStreet(),
                b.getLat() == null ? null : b.getLat().doubleValue(), b.getLng() == null ? null : b.getLng().doubleValue(),
                b.getHours(), b.getClosures(), b.getRating().doubleValue(), b.getReviewCount(), b.getSince(),
                b.getReplyMinutes(), eta, MarketRules.isOpen(b, now), distance(b, o, s), staff,
                b.getType() == BusinessType.PRODUCT ? b.getProductSettings() : null,
                b.getType() == BusinessType.SERVICE ? b.getBookingSettings() : null);
    }

    private static String shopText(Business b, Snapshot s) {
        Category c = s.categories().get(b.getCategoryId());
        return (b.getName() + " " + (c == null ? "" : c.getName()) + " " + b.getCategoryId() + " " + b.getDistrict())
                .toLowerCase(Locale.ROOT);
    }

    private static ListingReviewResponse review(Review r, String itemSlug) {
        return new ListingReviewResponse(r.getId().toString(), r.getBusinessId().toString(),
                r.getTargetId().toString(), itemSlug, r.getAuthorName(), r.getStars(), r.getText(), r.getTags(),
                r.getVariantName(), r.isVerified(), r.getReply(), r.getAt());
    }

    private static PromotionResponse promotion(Promotion p) {
        return new PromotionResponse(p.getId().toString(),
                p.getBusinessId() == null ? null : p.getBusinessId().toString(), p.getName(), p.getType(),
                p.getValue(), p.getCode(), p.getScope(), p.getTargetIds(), p.getMinSpend(), p.getMaxDiscount(),
                p.getStartsAt(), p.getEndsAt(), p.getUses(), p.getUsageLimit());
    }

    // ── lookups ──────────────────────────────────────────────────────────────────────

    private Business requireBusiness(String slugOrId) {
        Optional<Business> b = parse(slugOrId).flatMap(businesses::findById);
        // A suspended shop's page is gone too, not only its listing.
        return b.or(() -> businesses.findBySlug(slugOrId == null ? "" : slugOrId.trim().toLowerCase(Locale.ROOT)))
                .filter(x -> !x.isSuspended())
                .orElseThrow(() -> new BusinessException(StatusCode.BUSINESS_NOT_FOUND));
    }

    private Listing requireListed(Snapshot s, String slugOrId) {
        String key = slugOrId == null ? "" : slugOrId.trim();
        UUID id = parse(key).orElse(null);
        return baseItems(s).stream().filter(l -> l.slug().equals(key) || Objects.equals(l.id(), id)).findFirst()
                .orElseThrow(() -> new BusinessException(StatusCode.LISTING_NOT_FOUND));
    }

    private Origin origin(Double lat, Double lng, String district) {
        District d = null;
        if (district != null && !district.isBlank()) {
            String v = district.trim();
            d = districts.findByNameIgnoreCase(v).or(() -> districts.findById(v.toLowerCase(Locale.ROOT)))
                    .orElse(null);
        }
        boolean point = lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
        return new Origin(point ? lat : null, point ? lng : null, d);
    }

    /** Km from the origin to the shop; null without an origin. */
    private static Double distance(Business b, Origin o, Snapshot s) {
        Double lat = o.lat();
        Double lng = o.lng();
        if (lat == null && o.district() != null && o.district().getLat() != null) {
            lat = o.district().getLat().doubleValue();
            lng = o.district().getLng().doubleValue();
        }
        if (lat != null && b.getLat() != null && b.getLng() != null) {
            return MarketRules.km(lat, lng, b.getLat().doubleValue(), b.getLng().doubleValue());
        }
        District from = o.district();
        District to = s.districtsByName().get(b.getDistrict());
        if (from != null && to != null) {
            return Math.max(0.5, Math.abs(from.getKm().doubleValue() - to.getKm().doubleValue()));
        }
        return null;
    }

    private static List<MarketShopResponse> sortByDistance(List<MarketShopResponse> shops, Origin o) {
        if (o.lat() == null && o.district() == null) {
            return shops;
        }
        List<MarketShopResponse> out = new ArrayList<>(shops);
        out.sort(Comparator.comparing(MarketShopResponse::distanceKm, Comparator.nullsLast(Comparator.naturalOrder())));
        return out;
    }

    private static String kind(String type) {
        if (type == null) {
            return null;
        }
        return switch (type.toLowerCase(Locale.ROOT)) {
            case "product" -> "PRODUCT";
            case "service" -> "SERVICE";
            default -> null;
        };
    }

    private static int roleRank(MemberRole r) {
        return r == MemberRole.OWNER ? 0 : r == MemberRole.MANAGER ? 1 : 2;
    }

    private static Optional<UUID> parse(String s) {
        try {
            return s == null ? Optional.empty() : Optional.of(UUID.fromString(s.trim()));
        } catch (IllegalArgumentException ex) {
            return Optional.empty();
        }
    }
}
