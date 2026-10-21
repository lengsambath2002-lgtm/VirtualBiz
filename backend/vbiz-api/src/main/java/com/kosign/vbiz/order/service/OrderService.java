package com.kosign.vbiz.order.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.data.jpa.domain.Specification;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.payment.domain.PaymentMethod;
import com.kosign.vbiz.order.domain.OrderSource;
import com.kosign.vbiz.order.repository.OrderSpecs;
import com.kosign.vbiz.common.list.PageResponse;
import com.kosign.vbiz.common.list.PageQuery;
import com.kosign.vbiz.common.list.DayRange;
import com.kosign.vbiz.account.repository.UserRepository;
import com.kosign.vbiz.business.domain.Business;
import com.kosign.vbiz.business.domain.ProductSettings;
import com.kosign.vbiz.business.repository.BusinessRepository;
import com.kosign.vbiz.business.service.WorkspaceAccess;
import com.kosign.vbiz.business.service.WorkspaceAccess.Workspace;
import com.kosign.vbiz.cart.service.CartService;
import com.kosign.vbiz.catalog.domain.Product;
import com.kosign.vbiz.catalog.domain.ProductVariant;
import com.kosign.vbiz.catalog.repository.ProductRepository;
import com.kosign.vbiz.catalog.repository.ProductVariantRepository;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.helper.Money;
import com.kosign.vbiz.customer.service.ClientService;
import com.kosign.vbiz.delivery.domain.DeliveryProvider;
import com.kosign.vbiz.delivery.service.RiderDispatcher;
import com.kosign.vbiz.inventory.domain.StockReason;
import com.kosign.vbiz.inventory.service.StockWrite;
import com.kosign.vbiz.inventory.service.StockWriter;
import com.kosign.vbiz.order.domain.FulfilmentMethod;
import com.kosign.vbiz.order.domain.Order;
import com.kosign.vbiz.order.domain.OrderEvent;
import com.kosign.vbiz.order.domain.OrderLine;
import com.kosign.vbiz.order.domain.OrderStatus;
import com.kosign.vbiz.order.payload.BulkResultResponse;
import com.kosign.vbiz.order.payload.OrderCountsResponse;
import com.kosign.vbiz.order.payload.OrderResponse;
import com.kosign.vbiz.order.repository.OrderEventRepository;
import com.kosign.vbiz.order.repository.OrderLineRepository;
import com.kosign.vbiz.order.repository.OrderRepository;
import com.kosign.vbiz.payment.domain.Payment;
import com.kosign.vbiz.payment.domain.PaymentStatus;
import com.kosign.vbiz.payment.event.PaymentConfirmed;
import com.kosign.vbiz.payment.event.PaymentVoided;
import com.kosign.vbiz.payment.repository.PaymentRepository;
import com.kosign.vbiz.payment.service.PaymentService;

import lombok.RequiredArgsConstructor;

/**
 * Orders after checkout (docs/api/phase3-orders-checkout.md § Orders): the customer's list,
 * tracking and cancel; the seller's flow (accept → pack → ship / pickup → deliver, reject, failed
 * delivery, return); placing KHQR orders once paid; auto-cancel. Every status change goes through
 * {@link OrderStatus#transitionTo}; every stock change through {@link StockWriter}.
 */
@Service
@RequiredArgsConstructor
public class OrderService {

    static final ZoneId PHNOM_PENH = ZoneId.of("Asia/Phnom_Penh");

    public static final Set<String> CUSTOMER_REASONS = Set.of("mistake", "change", "slow", "other");
    public static final Set<String> REJECT_REASONS = Set.of("outOfStock", "cantDeliver", "listingError",
            "closingEarly");
    public static final Set<String> FAIL_REASONS = Set.of("noAnswer", "wrongAddress", "refused");
    public static final Set<String> RETURN_REASONS = Set.of("damaged", "wrongItem", "changedMind");
    public static final String AUTO = "auto";

    private static final int SELLER_LIMIT = 500;
    private static final int CUSTOMER_LIMIT = 200;

    private final OrderRepository orders;
    private final OrderLineRepository lines;
    private final OrderEventRepository events;
    private final OrderViews views;
    private final OrderNotifier notifier;
    private final OrderProperties props;
    private final StockWriter writer;
    private final PaymentService payments;
    private final PaymentRepository paymentRows;
    private final WorkspaceAccess access;
    private final BusinessRepository businesses;
    private final UserRepository users;
    private final ProductRepository products;
    private final ProductVariantRepository variants;
    private final CartService cart;
    private final ClientService clients;
    private final RiderDispatcher riders;
    private final Clock clock;

    // ── Customer ──────────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<OrderResponse> myOrders(UUID customerId, String bucket, String q) {
        List<Order> mine = orders.ofCustomer(customerId, PageRequest.of(0, CUSTOMER_LIMIT)).stream()
                .filter(o -> o.getPlacedAt() != null).filter(o -> bucket == null || bucket.isBlank()
                        || bucketOf(o.getStatus()).equals(bucket.trim().toLowerCase(Locale.ROOT)))
                .toList();
        return search(views.views(mine), q, false);
    }

    @Transactional(readOnly = true)
    public OrderResponse myOrder(UUID customerId, String ref) {
        return views.view(customerOrder(customerId, ref));
    }

    @Transactional
    public OrderResponse cancelMine(UUID customerId, String ref, String reason) {
        requireReason(reason, CUSTOMER_REASONS, "reason");
        Order o = lock(customerOrder(customerId, ref).getId());
        Instant now = clock.instant();
        if (o.getStatus() != OrderStatus.NEW || o.getPlacedAt() == null
                || now.isAfter(o.getPlacedAt().plus(props.customerCancelWindow()))) {
            throw new BusinessException(StatusCode.CANCEL_WINDOW_PASSED);
        }
        cancel(o, "customer." + reason, customerId, false, true);
        return views.view(o);
    }

    static String bucketOf(OrderStatus s) {
        return switch (s) {
            case CANCELLED -> "cancelled";
            case DELIVERED, PICKED_UP, RETURNED -> "done";
            default -> "active";
        };
    }

    // ── Seller ────────────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<OrderResponse> shopOrders(String tab, String q, Integer limit) {
        Workspace w = access.member();
        int n = limit == null ? SELLER_LIMIT : Math.max(1, Math.min(1000, limit));
        Set<OrderStatus> statuses = tabStatuses(tab);
        List<Order> rows = statuses == null
                ? orders.ofBusiness(w.businessId(), PageRequest.of(0, n))
                : orders.ofBusiness(w.businessId(), statuses, PageRequest.of(0, n));
        return search(views.views(rows), q, true);
    }

    /** Sort keys of the shop's order history → entity fields. */
    private static final Map<String, String> HISTORY_SORTS = Map.of("placed", "placedAt", "total", "total",
            "number", "number");

    /**
     * The shop's orders page by page (docs/api/phase16-shop-lists.md): every order, not only the
     * latest, with the list contract's sort, date range and paging.
     */
    @Transactional(readOnly = true)
    public PageResponse<OrderResponse> shopOrderHistory(String tab, String q, FulfilmentMethod method,
            PaymentMethod pay, OrderSource source, LocalDate from, LocalDate to, String sort, Integer page,
            Integer size) {
        Workspace w = access.member();
        DayRange range = DayRange.of(from, to, 3660);
        PageQuery pq = PageQuery.of(page, size, sort, HISTORY_SORTS, "-placed", null);
        Specification<Order> spec = historySpec(w.businessId(), tab, q, method, pay, source, range);
        String field = HISTORY_SORTS.get(pq.sortKey());
        org.springframework.data.domain.Sort order = pq.desc()
                ? org.springframework.data.domain.Sort.by(field).descending().and(
                        org.springframework.data.domain.Sort.by("number").descending())
                : org.springframework.data.domain.Sort.by(field).ascending().and(
                        org.springframework.data.domain.Sort.by("number").ascending());
        var result = orders.findAll(spec, PageRequest.of(pq.page(), pq.size(), order));
        return new PageResponse<>(views.views(result.getContent()), result.getTotalElements(), pq.page(), pq.size());
    }

    /** The order history's filters, shared with its CSV export. */
    public static Specification<Order> historySpec(UUID businessId, String tab, String q, FulfilmentMethod method,
            PaymentMethod pay, OrderSource source, DayRange range) {
        return Specification.allOf(OrderSpecs.placedBy(businessId), OrderSpecs.status(tabStatuses(tab)),
                OrderSpecs.placedFrom(range == null ? null : range.start()),
                OrderSpecs.placedBefore(range == null ? null : range.end()), OrderSpecs.method(method),
                OrderSpecs.paidWith(pay), OrderSpecs.source(source), OrderSpecs.text(q));
    }

    @Transactional(readOnly = true)
    public OrderResponse shopOrder(String ref) {
        return views.view(shopOrderOf(access.member(), ref));
    }

    @Transactional(readOnly = true)
    public OrderCountsResponse counts() {
        Workspace w = access.member();
        Map<OrderStatus, Long> open = new LinkedHashMap<>();
        for (Object[] row : orders.openCounts(w.businessId())) {
            open.put((OrderStatus) row[0], (Long) row[1]);
        }
        Instant today = LocalDate.now(clock.withZone(PHNOM_PENH)).atStartOfDay(PHNOM_PENH).toInstant();
        List<Order> td = orders.placedSince(w.businessId(), today);
        return new OrderCountsResponse(open.getOrDefault(OrderStatus.NEW, 0L),
                open.getOrDefault(OrderStatus.ACCEPTED, 0L), open.getOrDefault(OrderStatus.PACKED, 0L),
                open.getOrDefault(OrderStatus.SHIPPED, 0L),
                Money.usd(td.stream().map(Order::getTotal).reduce(Money.ZERO, java.math.BigDecimal::add)),
                td.size());
    }

    @Transactional
    public BulkResultResponse accept(List<UUID> ids) {
        Workspace w = access.member();
        Business shop = w.business();
        List<Order> done = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        for (UUID id : ids) {
            Order o = lockedShopOrder(w, id).orElse(null);
            if (o == null || o.getStatus() != OrderStatus.NEW) {
                skipped.add(id.toString());
                continue;
            }
            acceptNow(o, w.userId(), shop.getName());
            done.add(o);
        }
        return new BulkResultResponse(views.views(done), skipped);
    }

    /** Undo an accept within the undo window (the prototype's toast "Undo"). */
    @Transactional
    public BulkResultResponse undoAccept(List<UUID> ids) {
        Workspace w = access.member();
        Instant now = clock.instant();
        List<Order> done = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        for (UUID id : ids) {
            Order o = lockedShopOrder(w, id).orElse(null);
            if (o == null || o.getStatus() != OrderStatus.ACCEPTED || o.getAcceptedAt() == null) {
                skipped.add(id.toString());
                continue;
            }
            if (now.isAfter(o.getAcceptedAt().plus(props.undoAcceptWindow()))) {
                throw new BusinessException(StatusCode.UNDO_WINDOW_PASSED);
            }
            events.findByOrderIdAndStatusOrderByAtDesc(o.getId(), OrderStatus.ACCEPTED).stream().findFirst()
                    .ifPresent(events::delete);
            o.setStatus(OrderStatus.NEW);
            o.setAcceptedAt(null);
            notifier.changed(o, paymentStatus(o));
            done.add(o);
        }
        return new BulkResultResponse(views.views(done), skipped);
    }

    @Transactional
    public OrderResponse reject(String ref, String reason, boolean markSoldOut) {
        requireReason(reason, REJECT_REASONS, "reason");
        Workspace w = access.member();
        Order o = lock(shopOrderOf(w, ref).getId());
        if (o.getStatus() != OrderStatus.NEW) {
            throw new BusinessException(StatusCode.INVALID_STATUS_TRANSITION, o.getStatus(), OrderStatus.CANCELLED);
        }
        cancel(o, "rejected." + reason, w.userId(), true, false);
        if (markSoldOut) {
            for (UUID variantId : lines.findByOrderIdInOrderByPositionAsc(List.of(o.getId())).stream()
                    .map(OrderLine::getVariantId).distinct().toList()) {
                ProductVariant v = variants.findByIdAndBusinessId(variantId, o.getBusinessId()).orElse(null);
                if (v != null && v.getDeletedAt() == null && v.getStock() > 0) {
                    writer.write(new StockWrite(o.getBusinessId(), v.getId(), -v.getStock(),
                            StockReason.MARKED_SOLD_OUT, w.userId(), w.actorName(), o.getNumber(), false));
                }
            }
        }
        return views.view(o);
    }

    @Transactional
    public OrderResponse pack(String ref) {
        Workspace w = access.member();
        Order o = lock(shopOrderOf(w, ref).getId());
        packNow(o, w.userId(), w.business().getName());
        return views.view(o);
    }

    @Transactional
    public OrderResponse ship(String ref, DeliveryProvider by) {
        Workspace w = access.member();
        Order o = lock(shopOrderOf(w, ref).getId());
        shipNow(o, by, w.userId(), w.business());
        return views.view(o);
    }

    @Transactional
    public OrderResponse pickup(String ref) {
        Workspace w = access.member();
        Order o = lock(shopOrderOf(w, ref).getId());
        pickedUpNow(o, w.userId(), w.business().getName());
        return views.view(o);
    }

    @Transactional
    public OrderResponse deliver(String ref) {
        Workspace w = access.member();
        Order o = lock(shopOrderOf(w, ref).getId());
        move(o, OrderStatus.DELIVERED, w.userId(), null);
        o.setFulfilledAt(clock.instant());
        payments.markCollected(o.getId());
        notifier.fulfilled(o, w.business().getName());
        notifier.changed(o, paymentStatus(o));
        return views.view(o);
    }

    /** Failed delivery: back to PACKED (rider cleared) with a note on the timeline. */
    @Transactional
    public OrderResponse fail(String ref, String reason) {
        requireReason(reason, FAIL_REASONS, "reason");
        Workspace w = access.member();
        Order o = lock(shopOrderOf(w, ref).getId());
        move(o, OrderStatus.PACKED, w.userId(), "failed." + reason);
        o.setRider(null);
        o.setDeliveryBy(null);
        o.setShippedAt(null);
        notifier.changed(o, paymentStatus(o));
        return views.view(o);
    }

    @Transactional
    public OrderResponse giveBack(String ref, String reason, boolean restock) {
        requireReason(reason, RETURN_REASONS, "reason");
        Workspace w = access.member();
        Order o = lock(shopOrderOf(w, ref).getId());
        Instant now = clock.instant();
        // The shop's own return window (product settings), else the platform default.
        java.time.Duration window = w.business().getProductSettings() == null ? props.returnWindow()
                : java.time.Duration.ofDays(w.business().getProductSettings().returnDaysOrDefault());
        if (o.getStatus().isFulfilled() && (o.getFulfilledAt() == null
                || now.isAfter(o.getFulfilledAt().plus(window)))) {
            throw new BusinessException(StatusCode.RETURN_WINDOW_PASSED);
        }
        move(o, OrderStatus.RETURNED, w.userId(), null);
        o.setReturnedAt(now);
        o.setCancelReason("returned." + reason);
        if (restock) {
            restock(o, StockReason.CUSTOMER_RETURN, w.userId(), w.actorName());
        }
        payments.settleCancelled(o.getId(), o.getCancelReason());
        notifier.returned(o, w.business().getName());
        notifier.changed(o, paymentStatus(o));
        return views.view(o);
    }

    /** PACK: ACCEPTED → PACKED. SHIP: PACKED → SHIPPED (VirtualBiz rider) or PICKED_UP. */
    @Transactional
    public BulkResultResponse bulk(String action, List<UUID> ids) {
        Workspace w = access.member();
        String a = action == null ? "" : action.trim().toUpperCase(Locale.ROOT);
        if (!a.equals("PACK") && !a.equals("SHIP")) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "action", "Use PACK or SHIP");
        }
        List<Order> done = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        for (UUID id : ids) {
            Order o = lockedShopOrder(w, id).orElse(null);
            OrderStatus from = a.equals("PACK") ? OrderStatus.ACCEPTED : OrderStatus.PACKED;
            if (o == null || o.getStatus() != from) {
                skipped.add(id.toString());
                continue;
            }
            if (a.equals("PACK")) {
                packNow(o, w.userId(), w.business().getName());
            } else if (o.getMethod() == FulfilmentMethod.PICKUP) {
                pickedUpNow(o, w.userId(), w.business().getName());
            } else {
                shipNow(o, DeliveryProvider.VIRTUALBIZ_RIDER, w.userId(), w.business());
            }
            done.add(o);
        }
        return new BulkResultResponse(views.views(done), skipped);
    }

    // ── Placing (checkout, KHQR paid) and cancelling (payment voided, auto-cancel) ───────

    /** The order becomes visible to the shop: auto-accept, the shop's inbox, both streams. */
    void place(Order o, Business shop, String customerName) {
        o.setPlacedAt(clock.instant());
        java.util.Optional.ofNullable(o.getCustomerId()).flatMap(users::findById).ifPresent(u -> clients.linkOrderCustomer(o.getBusinessId(), u.getId(),
                u.getName(), u.getPhone() != null ? u.getPhone() : o.getAddress() == null ? null : o.getAddress().phone(),
                u.getEmail(), o.getAddress() == null ? null : o.getAddress().district()));
        ProductSettings ps = shop.getProductSettings();
        notifier.newOrder(o, customerName);
        if (ps != null && Boolean.TRUE.equals(ps.autoAccept())) {
            acceptNow(o, null, shop.getName());
        } else {
            notifier.changed(o, paymentStatus(o));
        }
    }

    @EventListener
    public void onPaymentConfirmed(PaymentConfirmed e) {
        for (UUID orderId : orderIdsOfIntent(e.intentId())) {
            Order o = lock(orderId);
            if (o.getStatus() != OrderStatus.NEW || o.getPlacedAt() != null) {
                continue;
            }
            Business shop = businesses.findById(o.getBusinessId()).orElseThrow();
            String name = users.findById(o.getCustomerId()).map(u -> u.getName()).orElse("");
            place(o, shop, name);
            cart.removePlaced(o.getCustomerId(), lines.findByOrderIdInOrderByPositionAsc(List.of(o.getId())).stream()
                    .map(OrderLine::getVariantId).toList());
        }
    }

    @EventListener
    public void onPaymentVoided(PaymentVoided e) {
        for (UUID orderId : orderIdsOfIntent(e.intentId())) {
            Order o = lock(orderId);
            if (o.getStatus() == OrderStatus.NEW) {
                cancel(o, e.reason(), null, PaymentService.PAYMENT_EXPIRED.equals(e.reason()), false);
            }
        }
    }

    /** Auto-cancel one order if it is still NEW and placed at or before {@code cutoff}. */
    @Transactional
    public boolean autoCancel(UUID orderId, Instant cutoff) {
        Order o = lock(orderId);
        if (o.getStatus() != OrderStatus.NEW || o.getPlacedAt() == null || o.getPlacedAt().isAfter(cutoff)) {
            return false;
        }
        cancel(o, AUTO, null, true, true);
        return true;
    }

    // ── VirtualBiz support (docs/api/phase7-admin.md § Orders) ──────────────────────────────

    /** Reason code on orders an admin cancelled or refunded; the admin's words go in the event note. */
    public static final String ADMIN_CANCEL = "admin.cancel";
    public static final String ADMIN_REFUND = "admin.refund";

    /**
     * Support cancels an order that has not left the shop (NEW, ACCEPTED or PACKED), e.g. to settle
     * a dispute: stock back, payment refunded, both sides told.
     */
    @Transactional
    public OrderResponse adminCancel(UUID orderId, UUID adminId, String note) {
        Order o = lock(orderId);
        if (o.getStatus() != OrderStatus.NEW && o.getStatus() != OrderStatus.ACCEPTED
                && o.getStatus() != OrderStatus.PACKED) {
            throw new BusinessException(StatusCode.INVALID_STATUS_TRANSITION, o.getStatus(), OrderStatus.CANCELLED);
        }
        record(o, OrderStatus.CANCELLED, adminId, note);
        settleCancel(o, ADMIN_CANCEL, true, true);
        return views.view(o);
    }

    /**
     * Support refunds a delivered or picked-up order (no return window): it becomes RETURNED, the
     * payment is refunded and, when {@code restock}, the items go back on the shelf.
     */
    @Transactional
    public OrderResponse adminRefund(UUID orderId, UUID adminId, String note, boolean restock) {
        Order o = lock(orderId);
        move(o, OrderStatus.RETURNED, adminId, note);
        o.setReturnedAt(clock.instant());
        o.setCancelReason(ADMIN_REFUND);
        if (restock) {
            restock(o, StockReason.CUSTOMER_RETURN, adminId, "VirtualBiz support");
        }
        payments.settleCancelled(o.getId(), o.getCancelReason());
        String shopName = businesses.findById(o.getBusinessId()).map(Business::getName).orElse("");
        notifier.returned(o, shopName);
        notifier.changed(o, paymentStatus(o));
        return views.view(o);
    }

    public List<UUID> dueForAutoCancel(Instant now) {
        return orders.dueForAutoCancel(now.minus(props.autoCancelAfter()));
    }

    /** Local test hook: pretend the order was placed {@code minutes} earlier. */
    @Transactional
    public OrderResponse age(String ref, int minutes) {
        Order o = lock(find(ref).getId());
        if (o.getPlacedAt() != null) {
            o.setPlacedAt(o.getPlacedAt().minusSeconds(minutes * 60L));
        }
        return views.view(o);
    }

    // ── internals ─────────────────────────────────────────────────────────────────────

    private void acceptNow(Order o, UUID by, String shopName) {
        move(o, OrderStatus.ACCEPTED, by, null);
        o.setAcceptedAt(clock.instant());
        notifier.accepted(o, shopName);
        notifier.changed(o, paymentStatus(o));
    }

    private void packNow(Order o, UUID by, String shopName) {
        move(o, OrderStatus.PACKED, by, null);
        o.setPackedAt(clock.instant());
        notifier.ready(o, shopName);
        notifier.changed(o, paymentStatus(o));
    }

    private void shipNow(Order o, DeliveryProvider by, UUID userId, Business shop) {
        move(o, OrderStatus.SHIPPED, userId, null);
        o.setShippedAt(clock.instant());
        o.setDeliveryBy(by);
        o.setRider(by == DeliveryProvider.VIRTUALBIZ_RIDER
                ? riders.assign(o.getNumber(), shop.getDistrict(),
                        o.getAddress() == null ? null : o.getAddress().district())
                : null);
        notifier.onTheWay(o, shop.getName());
        notifier.changed(o, paymentStatus(o));
    }

    private void pickedUpNow(Order o, UUID by, String shopName) {
        move(o, OrderStatus.PICKED_UP, by, null);
        o.setFulfilledAt(clock.instant());
        payments.markCollected(o.getId());
        notifier.fulfilled(o, shopName);
        notifier.changed(o, paymentStatus(o));
    }

    /**
     * Cancel (NEW only): stock back as automatic {@code ORDER_CANCELLED} rows, the sold counts
     * undone, the payment refunded or cancelled, the other party told.
     */
    private void cancel(Order o, String reason, UUID by, boolean tellCustomer, boolean tellShop) {
        move(o, OrderStatus.CANCELLED, by, null);
        settleCancel(o, reason, tellCustomer, tellShop);
    }

    private void settleCancel(Order o, String reason, boolean tellCustomer, boolean tellShop) {
        o.setCancelledAt(clock.instant());
        o.setCancelReason(reason);
        restock(o, StockReason.ORDER_CANCELLED, null, null);
        adjustSold(o, -1);
        PaymentStatus ps = payments.settleCancelled(o.getId(), reason);
        String shopName = businesses.findById(o.getBusinessId()).map(Business::getName).orElse("");
        notifier.cancelled(o, shopName, tellCustomer, tellShop);
        notifier.changed(o, ps);
    }

    private void restock(Order o, StockReason reason, UUID by, String byName) {
        List<OrderLine> ls = lines.findByOrderIdInOrderByPositionAsc(List.of(o.getId()));
        Set<UUID> live = variants.findAllById(ls.stream().map(OrderLine::getVariantId).collect(Collectors.toSet()))
                .stream().filter(v -> v.getDeletedAt() == null).map(ProductVariant::getId)
                .collect(Collectors.toSet());
        List<StockWrite> writes = ls.stream().filter(l -> live.contains(l.getVariantId()))
                .map(l -> new StockWrite(o.getBusinessId(), l.getVariantId(), l.getQty(), reason, by, byName,
                        o.getNumber(), false))
                .toList();
        if (!writes.isEmpty()) {
            writer.writeAll(writes, i -> "lines[" + i + "]");
        }
    }

    /** {@code sign} +1 on placement, −1 on cancellation (never below zero). */
    void adjustSold(Order o, int sign) {
        Map<UUID, Integer> qty = new LinkedHashMap<>();
        lines.findByOrderIdInOrderByPositionAsc(List.of(o.getId()))
                .forEach(l -> qty.merge(l.getProductId(), l.getQty(), Integer::sum));
        for (Product p : products.findAllById(qty.keySet())) {
            p.setSoldCount(Math.max(0, p.getSoldCount() + sign * qty.get(p.getId())));
        }
    }

    private void move(Order o, OrderStatus target, UUID by, String note) {
        o.getStatus().transitionTo(target, o.getMethod());
        record(o, target, by, note);
    }

    /** Sets the status and logs it, without the transition check (support overrides only). */
    private void record(Order o, OrderStatus target, UUID by, String note) {
        o.setStatus(target);
        OrderEvent e = new OrderEvent();
        e.setOrderId(o.getId());
        e.setStatus(target);
        e.setNote(note);
        e.setByUserId(by);
        e.setAt(clock.instant());
        events.save(e);
    }

    private PaymentStatus paymentStatus(Order o) {
        return paymentRows.findFirstByOrderId(o.getId()).map(Payment::getStatus).orElse(null);
    }

    private List<UUID> orderIdsOfIntent(UUID intentId) {
        return paymentRows.findByIntentId(intentId).stream().map(Payment::getOrderId).distinct().toList();
    }

    Order lock(UUID id) {
        return orders.lockById(id).orElseThrow(() -> new BusinessException(StatusCode.ORDER_NOT_FOUND));
    }

    /** By number ({@code VB-…}) or id. */
    Order find(String ref) {
        Optional<Order> o = Optional.empty();
        if (ref != null) {
            String r = ref.trim();
            o = r.toUpperCase(Locale.ROOT).startsWith("VB-") ? orders.findByNumber(r.toUpperCase(Locale.ROOT))
                    : parseUuid(r).flatMap(orders::findById);
        }
        return o.orElseThrow(() -> new BusinessException(StatusCode.ORDER_NOT_FOUND));
    }

    private Order customerOrder(UUID customerId, String ref) {
        Order o = find(ref);
        if (!customerId.equals(o.getCustomerId())) {
            throw new BusinessException(StatusCode.ORDER_NOT_FOUND);
        }
        return o;
    }

    private Order shopOrderOf(Workspace w, String ref) {
        Order o = find(ref);
        if (!o.getBusinessId().equals(w.businessId()) || o.getPlacedAt() == null) {
            throw new BusinessException(StatusCode.ORDER_NOT_FOUND);
        }
        return o;
    }

    private Optional<Order> lockedShopOrder(Workspace w, UUID id) {
        return orders.lockById(id).filter(o -> o.getBusinessId().equals(w.businessId()) && o.getPlacedAt() != null);
    }

    private static Optional<UUID> parseUuid(String s) {
        try {
            return Optional.of(UUID.fromString(s));
        } catch (IllegalArgumentException ex) {
            return Optional.empty();
        }
    }

    private static void requireReason(String reason, Set<String> allowed, String field) {
        if (reason == null || !allowed.contains(reason)) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, field, "Use one of " + allowed);
        }
    }

    private static Set<OrderStatus> tabStatuses(String tab) {
        if (tab == null || tab.isBlank() || tab.equalsIgnoreCase("all")) {
            return null;
        }
        return switch (tab.trim().toLowerCase(Locale.ROOT)) {
            case "new" -> EnumSet.of(OrderStatus.NEW);
            case "pack" -> EnumSet.of(OrderStatus.ACCEPTED);
            case "ship" -> EnumSet.of(OrderStatus.PACKED, OrderStatus.SHIPPED);
            case "done" -> EnumSet.of(OrderStatus.DELIVERED, OrderStatus.PICKED_UP);
            case "cancelled" -> EnumSet.of(OrderStatus.CANCELLED, OrderStatus.RETURNED);
            default -> throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "tab",
                    "Use new, pack, ship, done, cancelled or all");
        };
    }

    /** Number, item title, or (seller) the customer's name / phone. */
    private static List<OrderResponse> search(List<OrderResponse> rows, String q, boolean customerFields) {
        if (q == null || q.isBlank()) {
            return rows;
        }
        String needle = q.trim().toLowerCase(Locale.ROOT);
        Set<String> hits = new HashSet<>();
        List<OrderResponse> out = new ArrayList<>();
        for (OrderResponse o : rows) {
            StringBuilder hay = new StringBuilder(o.number());
            o.lines().forEach(l -> hay.append(' ').append(l.title()));
            if (customerFields && o.customer() != null) {
                hay.append(' ').append(o.customer().name()).append(' ').append(o.customer().phone());
            }
            if (hay.toString().toLowerCase(Locale.ROOT).contains(needle) && hits.add(o.id())) {
                out.add(o);
            }
        }
        return out;
    }
}
