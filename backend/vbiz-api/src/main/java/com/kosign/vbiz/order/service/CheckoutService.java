package com.kosign.vbiz.order.service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kosign.vbiz.account.domain.Address;
import com.kosign.vbiz.account.domain.User;
import com.kosign.vbiz.account.repository.AddressRepository;
import com.kosign.vbiz.account.repository.UserRepository;
import com.kosign.vbiz.business.domain.Business;
import com.kosign.vbiz.business.domain.BusinessType;
import com.kosign.vbiz.business.domain.ProductSettings;
import com.kosign.vbiz.business.domain.VerificationStatus;
import com.kosign.vbiz.business.repository.BusinessRepository;
import com.kosign.vbiz.cart.service.CartService;
import com.kosign.vbiz.catalog.domain.Product;
import com.kosign.vbiz.catalog.domain.ProductStatus;
import com.kosign.vbiz.catalog.domain.ProductVariant;
import com.kosign.vbiz.catalog.mapper.CatalogMapper;
import com.kosign.vbiz.catalog.repository.ProductRepository;
import com.kosign.vbiz.catalog.repository.ProductVariantRepository;
import com.kosign.vbiz.common.api.ApiErrorDetail;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.security.SecureTokens;
import com.kosign.vbiz.inventory.domain.StockReason;
import com.kosign.vbiz.inventory.service.StockWrite;
import com.kosign.vbiz.inventory.service.StockWriter;
import com.kosign.vbiz.meta.service.ReferenceDataService;
import com.kosign.vbiz.order.domain.Checkout;
import com.kosign.vbiz.order.domain.FulfilmentMethod;
import com.kosign.vbiz.order.domain.Order;
import com.kosign.vbiz.order.domain.OrderAddress;
import com.kosign.vbiz.order.domain.OrderEvent;
import com.kosign.vbiz.order.domain.OrderLine;
import com.kosign.vbiz.order.domain.OrderStatus;
import com.kosign.vbiz.order.payload.CheckoutInput;
import com.kosign.vbiz.order.payload.CheckoutResultResponse;
import com.kosign.vbiz.order.payload.QuoteResponse;
import com.kosign.vbiz.order.repository.CheckoutRepository;
import com.kosign.vbiz.order.repository.OrderEventRepository;
import com.kosign.vbiz.order.repository.OrderLineRepository;
import com.kosign.vbiz.order.repository.OrderRepository;
import com.kosign.vbiz.payment.domain.PaymentIntent;
import com.kosign.vbiz.payment.domain.PaymentMethod;
import com.kosign.vbiz.payment.service.PaymentService;
import com.kosign.vbiz.promotion.domain.Promotion;
import com.kosign.vbiz.promotion.repository.PromotionRepository;
import com.kosign.vbiz.promotion.service.PromoEngine;

import lombok.RequiredArgsConstructor;

/**
 * Quote and place a checkout (docs/api/phase3-orders-checkout.md § Checkout): one order per shop,
 * server-side totals, promo code, delivery fees, stock through {@link StockWriter#writeAll}, the
 * payment session, idempotent on the customer's {@code Idempotency-Key}.
 */
@Service
@RequiredArgsConstructor
public class CheckoutService {

    private static final Pattern WINDOW = Pattern.compile("^(\\d{2}):00\\s*[–-]\\s*(\\d{2}):00$");
    private static final int FIRST_WINDOW_HOUR = 9;
    private static final int LAST_WINDOW_END = 22;
    private static final int WINDOW_LEAD_HOURS = 2;

    private final ProductVariantRepository variants;
    private final ProductRepository products;
    private final BusinessRepository businesses;
    private final AddressRepository addresses;
    private final UserRepository users;
    private final PromotionRepository promotions;
    private final ReferenceDataService reference;
    private final CheckoutRepository checkouts;
    private final OrderRepository orders;
    private final OrderLineRepository lines;
    private final OrderEventRepository events;
    private final StockWriter writer;
    private final PaymentService payments;
    private final OrderService orderService;
    private final OrderViews views;
    private final CartService cart;
    private final ObjectMapper json;
    private final Clock clock;

    // ── Quote ─────────────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public QuoteResponse quote(UUID userId, CheckoutInput in) {
        FulfilmentMethod method = in.methodOrDefault();
        String district = null;
        if (in.addressId() != null) {
            if (userId == null) {
                throw new BusinessException(StatusCode.UNAUTHORIZED);
            }
            district = ownedAddress(userId, in.addressId()).getDistrict();
        } else if (in.district() != null && !in.district().isBlank()) {
            try {
                district = reference.canonicalDistrict(in.district());
            } catch (BusinessException ex) {
                district = null;
            }
        }
        List<CheckoutPricer.Input> inputs = load(in.lines());
        Promotion promo = findPromo(in.promoCode(), inputs);
        CheckoutPricer.Priced p = CheckoutPricer.price(inputs, method, district, in.promoCode(), promo,
                automaticPromos(inputs, clock.instant()), clock.instant());
        return toQuote(p, in);
    }

    // ── Place ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public CheckoutResultResponse place(UUID userId, String idempotencyKey, CheckoutInput in) {
        String key = idempotencyKey == null ? "" : idempotencyKey.trim();
        if (key.length() < 8 || key.length() > 64) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "Idempotency-Key",
                    "Send an Idempotency-Key header of 8–64 characters");
        }
        String hash = requestHash(in);
        Checkout previous = checkouts.findByCustomerIdAndIdempotencyKey(userId, key).orElse(null);
        if (previous != null) {
            if (!previous.getRequestHash().equals(hash)) {
                throw new BusinessException(StatusCode.IDEMPOTENCY_CONFLICT);
            }
            return result(previous);
        }
        if (in.paymentMethod() == null) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "paymentMethod", "Choose how to pay");
        }
        FulfilmentMethod method = in.methodOrDefault();
        Address address = null;
        if (method == FulfilmentMethod.DELIVERY) {
            if (in.addressId() == null) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "addressId",
                        "Choose a delivery address");
            }
            address = ownedAddress(userId, in.addressId());
        }
        Instant now = clock.instant();
        String window = in.window() == null || in.window().isBlank() ? null : in.window().trim();
        Instant scheduledFor = window == null ? null : windowStart(window, now);
        String note = in.note() == null || in.note().isBlank() ? null : in.note().trim();

        List<CheckoutPricer.Input> inputs = load(in.lines());
        List<ApiErrorDetail> gone = inputs.stream().filter(i -> i.variant() == null)
                .map(i -> new ApiErrorDetail("lines[" + i.index() + "]", "This item is no longer available",
                        Map.of("variantId", i.variantId().toString())))
                .toList();
        if (!gone.isEmpty()) {
            throw BusinessException.withDetails(StatusCode.VARIANT_NOT_FOUND, gone);
        }
        Promotion promo = findPromo(in.promoCode(), inputs);
        CheckoutPricer.Priced priced = CheckoutPricer.price(inputs, method,
                address == null ? null : address.getDistrict(), in.promoCode(), promo, automaticPromos(inputs, now), now);
        for (CheckoutPricer.Shop s : priced.shops()) {
            requireShopTakes(s.shop(), method, in.paymentMethod());
        }
        if (priced.promo() != null && !priced.promo().applied()) {
            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("reason", priced.promo().reason().name());
            if (priced.promo().shortBy() != null) {
                meta.put("shortBy", priced.promo().shortBy());
            }
            throw BusinessException.withDetail(StatusCode.PROMO_INVALID, "promoCode", "The code does not apply", meta);
        }
        if (priced.total().signum() <= 0) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "lines", "Nothing to pay for");
        }

        Checkout checkout = new Checkout();
        checkout.setCustomerId(userId);
        checkout.setIdempotencyKey(key);
        checkout.setRequestHash(hash);
        checkout.setPaymentMethod(in.paymentMethod());
        checkout.setTotal(priced.total());
        checkout = checkouts.saveAndFlush(checkout);

        // Numbers first: each stock movement names its order.
        List<String> numbers = new ArrayList<>();
        for (int i = 0; i < priced.shops().size(); i++) {
            numbers.add(String.format("VB-%05d", orders.nextNumber()));
        }
        List<StockWrite> writes = new ArrayList<>();
        List<Integer> lineIndex = new ArrayList<>();
        for (int i = 0; i < priced.shops().size(); i++) {
            for (CheckoutPricer.Line l : priced.shops().get(i).lines()) {
                writes.add(new StockWrite(l.shop().getId(), l.variant().getId(), -l.qty(), StockReason.ORDER_SALE,
                        null, null, numbers.get(i), false));
                lineIndex.add(l.index());
            }
        }
        writer.writeAll(writes, k -> "lines[" + lineIndex.get(k) + "]");

        if (priced.promo() != null && priced.promo().applied()) {
            Promotion locked = promotions.lockById(priced.promo().promotion().getId()).orElseThrow();
            if (locked.getUsageLimit() != null && locked.getUses() >= locked.getUsageLimit()) {
                throw BusinessException.withDetail(StatusCode.PROMO_INVALID, "promoCode", "The code is used up",
                        Map.of("reason", PromoEngine.Reason.USED_UP.name()));
            }
            locked.setUses(locked.getUses() + 1);
        }
        for (CheckoutPricer.Shop s : priced.shops()) {
            if (s.auto() != null) {
                Promotion locked = promotions.lockById(s.auto().promotion().getId()).orElseThrow();
                locked.setUses(locked.getUses() + 1);
            }
        }

        User customer = users.findById(userId).orElseThrow(() -> new BusinessException(StatusCode.USER_NOT_FOUND));
        List<Order> made = new ArrayList<>();
        for (int i = 0; i < priced.shops().size(); i++) {
            made.add(createOrder(checkout, customer, priced, priced.shops().get(i), numbers.get(i), method, address,
                    window, scheduledFor, note, now));
        }

        PaymentIntent intent = null;
        if (in.paymentMethod() == PaymentMethod.KHQR) {
            intent = payments.createKhqr(checkout.getId(), userId, priced.total(), numbers.get(0));
        } else if (in.paymentMethod() == PaymentMethod.CARD) {
            intent = payments.chargeCard(checkout.getId(), userId, priced.total(), String.join(",", numbers));
        }
        for (Order o : made) {
            Business shop = businesses.findById(o.getBusinessId()).orElseThrow();
            payments.createForOrder(o.getId(), intent == null ? null : intent.getId(), in.paymentMethod(),
                    o.getTotal(), shop.getBakongId(), in.paymentMethod() == PaymentMethod.CARD);
        }
        if (in.paymentMethod() != PaymentMethod.KHQR) {
            for (Order o : made) {
                orderService.place(o, businesses.findById(o.getBusinessId()).orElseThrow(), customer.getName());
            }
            cart.removePlaced(userId, priced.shops().stream().flatMap(s -> s.lines().stream())
                    .map(l -> l.variant().getId()).toList());
        }
        return new CheckoutResultResponse(checkout.getId().toString(), views.views(made),
                intent == null ? null : PaymentService.toResponse(intent, numbers));
    }

    private Order createOrder(Checkout checkout, User customer, CheckoutPricer.Priced priced, CheckoutPricer.Shop s,
            String number, FulfilmentMethod method, Address a, String window, Instant scheduledFor, String note,
            Instant now) {
        Order o = new Order();
        o.setNumber(number);
        o.setCheckoutId(checkout.getId());
        o.setBusinessId(s.shop().getId());
        o.setCustomerId(customer.getId());
        o.setStatus(OrderStatus.NEW);
        o.setMethod(method);
        if (a != null) {
            o.setAddress(new OrderAddress(a.getLabel().name(), a.getName(), a.getPhone(), a.getLine(), a.getDistrict(),
                    a.getNote(), a.getLat(), a.getLng()));
        }
        o.setDeliveryWindow(window);
        o.setScheduledFor(scheduledFor);
        o.setNote(note);
        o.setSubtotal(s.subtotal());
        o.setDiscount(s.discount());
        o.setPromoDiscount(s.promoDiscount());
        boolean promoUsed = priced.promo() != null && priced.promo().applied()
                && (s.promoDiscount().signum() > 0 || s.deliveryWaived());
        if (promoUsed) {
            o.setPromoCode(priced.promo().promotion().getCode().toUpperCase());
            o.setPromotionId(priced.promo().promotion().getId());
        }
        o.setDeliveryFee(s.deliveryFee());
        o.setTotal(s.total());
        o = orders.saveAndFlush(o);
        int pos = 0;
        List<OrderLine> rows = new ArrayList<>();
        for (CheckoutPricer.Line l : s.lines()) {
            OrderLine r = new OrderLine();
            r.setOrderId(o.getId());
            r.setVariantId(l.variant().getId());
            r.setProductId(l.product().getId());
            r.setProductSlug(l.product().getSlug());
            r.setTitle(l.product().getTitle());
            r.setVariantName(CatalogMapper.variantName(l.variant().getOptionValues()));
            r.setOptions(CatalogMapper.optionMap(l.product().getOptions(), l.variant().getOptionValues()));
            r.setSku(l.variant().getSku() == null ? "" : l.variant().getSku());
            r.setQty(l.qty());
            r.setListPrice(l.listPrice());
            r.setUnitPrice(l.unitPrice());
            r.setPosition(pos++);
            rows.add(r);
        }
        lines.saveAll(rows);
        OrderEvent e = new OrderEvent();
        e.setOrderId(o.getId());
        e.setStatus(OrderStatus.NEW);
        e.setByUserId(customer.getId());
        e.setAt(now);
        events.save(e);
        lines.flush();
        orderService.adjustSold(o, +1);
        return o;
    }

    private CheckoutResultResponse result(Checkout c) {
        List<Order> made = orders.findByCheckoutIdOrderByNumberAsc(c.getId());
        PaymentIntent intent = payments.intentOfCheckout(c.getId());
        return new CheckoutResultResponse(c.getId().toString(), views.views(made), intent == null ? null
                : PaymentService.toResponse(intent, made.stream().map(Order::getNumber).toList()));
    }

    // ── helpers ───────────────────────────────────────────────────────────────────────

    /** The lines with their variant, product and shop; null when gone or not listed. */
    private List<CheckoutPricer.Input> load(List<CheckoutInput.Line> in) {
        Set<UUID> ids = in.stream().map(CheckoutInput.Line::variantId).collect(Collectors.toSet());
        Map<UUID, ProductVariant> vs = variants.findAllById(ids).stream().filter(v -> v.getDeletedAt() == null)
                .collect(Collectors.toMap(ProductVariant::getId, Function.identity()));
        Map<UUID, Product> ps = products.findAllById(vs.values().stream().map(ProductVariant::getProductId)
                .collect(Collectors.toSet())).stream()
                .filter(p -> p.getDeletedAt() == null && p.getStatus() == ProductStatus.ACTIVE)
                .collect(Collectors.toMap(Product::getId, Function.identity()));
        Map<UUID, Business> bs = businesses.findAllById(ps.values().stream().map(Product::getBusinessId)
                .collect(Collectors.toSet())).stream()
                .filter(b -> b.getType() == BusinessType.PRODUCT && b.getVerification() != VerificationStatus.REJECTED)
                .collect(Collectors.toMap(Business::getId, Function.identity()));
        List<CheckoutPricer.Input> out = new ArrayList<>();
        for (int i = 0; i < in.size(); i++) {
            CheckoutInput.Line l = in.get(i);
            ProductVariant v = vs.get(l.variantId());
            Product p = v == null ? null : ps.get(v.getProductId());
            Business b = p == null ? null : bs.get(p.getBusinessId());
            out.add(b == null ? new CheckoutPricer.Input(i, l.variantId(), l.qty(), null, null, null)
                    : new CheckoutPricer.Input(i, l.variantId(), l.qty(), v, p, b));
        }
        return out;
    }

    /** The checkout shops' automatic promotions running now, by shop. */
    private Map<UUID, List<Promotion>> automaticPromos(List<CheckoutPricer.Input> inputs, Instant now) {
        Set<UUID> shops = new HashSet<>();
        inputs.stream().filter(i -> i.shop() != null).forEach(i -> shops.add(i.shop().getId()));
        if (shops.isEmpty()) {
            return Map.of();
        }
        Map<UUID, List<Promotion>> out = new java.util.LinkedHashMap<>();
        for (Promotion p : promotions.activeAutomatic(shops, now)) {
            out.computeIfAbsent(p.getBusinessId(), k -> new ArrayList<>()).add(p);
        }
        return out;
    }

    /** The code's promotion (platform, or one of the checkout's shops); null when none / unknown. */
    private Promotion findPromo(String code, List<CheckoutPricer.Input> inputs) {
        if (code == null || code.isBlank()) {
            return null;
        }
        Set<UUID> shops = new HashSet<>();
        inputs.stream().filter(i -> i.shop() != null).forEach(i -> shops.add(i.shop().getId()));
        if (shops.isEmpty()) {
            shops.add(new UUID(0, 0));
        }
        List<Promotion> found = promotions.findByCode(code.trim(), shops);
        return found.isEmpty() ? null : found.get(0);
    }

    private Address ownedAddress(UUID userId, UUID id) {
        return addresses.findByIdAndUserId(id, userId)
                .orElseThrow(() -> BusinessException.withDetail(StatusCode.ADDRESS_NOT_FOUND, "addressId",
                        "Unknown address"));
    }

    private static void requireShopTakes(Business b, FulfilmentMethod method, PaymentMethod pay) {
        Map<String, Object> meta = Map.of("businessId", b.getId().toString());
        if (!b.isOnline() || b.isSuspended()) {
            throw BusinessException.withDetail(StatusCode.SHOP_UNAVAILABLE, "lines", b.getName() + " is offline", meta);
        }
        ProductSettings ps = b.getProductSettings();
        if (method == FulfilmentMethod.PICKUP && ps != null && Boolean.FALSE.equals(ps.pickup())) {
            throw BusinessException.withDetail(StatusCode.FULFILMENT_UNAVAILABLE, "method",
                    b.getName() + " does not offer pickup", meta);
        }
        if (pay == PaymentMethod.CASH && method == FulfilmentMethod.DELIVERY && ps != null
                && Boolean.FALSE.equals(ps.cod())) {
            throw BusinessException.withDetail(StatusCode.PAYMENT_METHOD_UNAVAILABLE, "paymentMethod",
                    b.getName() + " does not take cash on delivery", meta);
        }
    }

    /**
     * "HH:00–HH:00" today in Phnom Penh: one hour, between 09:00 and 22:00, starting at least
     * 2 hours from now (the checkout's "Schedule for today" list).
     */
    Instant windowStart(String window, Instant now) {
        Matcher m = WINDOW.matcher(window);
        if (!m.matches()) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "window", "Use HH:00–HH:00");
        }
        int start = Integer.parseInt(m.group(1));
        int end = Integer.parseInt(m.group(2));
        ZonedDateTime local = now.atZone(OrderService.PHNOM_PENH);
        int earliest = Math.max(local.getHour() + WINDOW_LEAD_HOURS, FIRST_WINDOW_HOUR);
        if (end != start + 1 || start < earliest || end > LAST_WINDOW_END) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "window",
                    "Pick a window today between " + earliest + ":00 and 22:00");
        }
        LocalDate day = local.toLocalDate();
        return day.atTime(LocalTime.of(start, 0)).atZone(OrderService.PHNOM_PENH).toInstant();
    }

    private String requestHash(CheckoutInput in) {
        try {
            return SecureTokens.sha256Hex(json.writeValueAsString(in));
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private QuoteResponse toQuote(CheckoutPricer.Priced p, CheckoutInput in) {
        List<QuoteResponse.Problem> problems = new ArrayList<>();
        Map<Integer, UUID> variantAt = new HashMap<>();
        for (int i = 0; i < in.lines().size(); i++) {
            variantAt.put(i, in.lines().get(i).variantId());
        }
        p.missing().forEach(i -> problems.add(new QuoteResponse.Problem("lines[" + i + "]", "VARIANT_NOT_FOUND",
                variantAt.get(i).toString(), null)));
        p.shortOf().forEach((i, stock) -> problems.add(new QuoteResponse.Problem("lines[" + i + "]",
                "INSUFFICIENT_STOCK", variantAt.get(i).toString(), stock)));
        List<QuoteResponse.Shop> shops = p.shops().stream().map(s -> {
            ProductSettings ps = s.shop().getProductSettings();
            return new QuoteResponse.Shop(s.shop().getId().toString(), s.shop().getSlug(), s.shop().getName(),
                    s.lines().stream().map(l -> new QuoteResponse.Line(l.variant().getId().toString(),
                            l.product().getId().toString(), l.product().getSlug(), l.product().getTitle(),
                            CatalogMapper.variantName(l.variant().getOptionValues()),
                            CatalogMapper.optionMap(l.product().getOptions(), l.variant().getOptionValues()), l.qty(),
                            l.listPrice(), l.unitPrice(), com.kosign.vbiz.common.helper.Money.usd(l.netTotal()),
                            l.variant().getStock())).toList(),
                    s.subtotal(), s.discount(), s.promoDiscount(), s.deliveryFee(), s.deliveryWaived(),
                    ps == null ? null : ps.freeDeliveryOver(), s.toFree(), s.total(),
                    ps == null || !Boolean.FALSE.equals(ps.pickup()), ps == null || !Boolean.FALSE.equals(ps.cod()),
                    s.auto() == null ? null : new QuoteResponse.AutoPromo(s.auto().promotion().getId().toString(),
                            s.auto().promotion().getName(), s.auto().discount(), s.auto().freeShipping()));
        }).toList();
        QuoteResponse.Promo promo = null;
        if (p.promo() != null) {
            PromoEngine.Result r = p.promo();
            Promotion x = r.promotion();
            promo = x == null
                    ? new QuoteResponse.Promo(in.promoCode().trim().toUpperCase(), null, null, null, null, null, null,
                            false, PromoEngine.Reason.UNKNOWN.name(), null)
                    : new QuoteResponse.Promo(x.getCode().toUpperCase(), x.getName(), x.getType().name(), x.getValue(),
                            x.getMinSpend(), x.getMaxDiscount(),
                            x.getBusinessId() == null ? null : x.getBusinessId().toString(), r.applied(),
                            r.reason() == null ? null : r.reason().name(), r.shortBy());
        }
        BigDecimal total = p.total();
        return new QuoteResponse(p.method().name(), p.district(), p.count(), p.subtotal(), p.discount(),
                p.promoDiscount(), p.deliveryFee(), total, shops, promo, problems);
    }
}
