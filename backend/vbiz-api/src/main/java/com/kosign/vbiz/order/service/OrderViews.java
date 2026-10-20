package com.kosign.vbiz.order.service;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.account.domain.User;
import com.kosign.vbiz.account.repository.UserRepository;
import com.kosign.vbiz.business.domain.Business;
import com.kosign.vbiz.business.repository.BusinessRepository;
import com.kosign.vbiz.order.domain.Order;
import com.kosign.vbiz.order.domain.OrderEvent;
import com.kosign.vbiz.order.domain.OrderLine;
import com.kosign.vbiz.order.domain.OrderStatus;
import com.kosign.vbiz.order.payload.OrderResponse;
import com.kosign.vbiz.order.repository.OrderEventRepository;
import com.kosign.vbiz.order.repository.OrderLineRepository;
import com.kosign.vbiz.payment.domain.Payment;
import com.kosign.vbiz.payment.service.PaymentService;

import lombok.RequiredArgsConstructor;

/** Builds {@link OrderResponse}s for a batch of orders (lines, timeline, payment, shop, customer). */
@Service
@RequiredArgsConstructor
public class OrderViews {

    private final OrderLineRepository lines;
    private final OrderEventRepository events;
    private final PaymentService payments;
    private final BusinessRepository businesses;
    private final UserRepository users;
    private final OrderProperties props;
    private final Clock clock;

    @Transactional(readOnly = true)
    public OrderResponse view(Order o) {
        return views(List.of(o)).get(0);
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> views(List<Order> orders) {
        if (orders.isEmpty()) {
            return List.of();
        }
        Set<UUID> ids = orders.stream().map(Order::getId).collect(Collectors.toSet());
        Map<UUID, List<OrderLine>> linesOf = lines.findByOrderIdInOrderByPositionAsc(ids).stream()
                .collect(Collectors.groupingBy(OrderLine::getOrderId));
        Map<UUID, List<OrderEvent>> eventsOf = events.findByOrderIdInOrderByAtAscCreatedAtAsc(ids).stream()
                .collect(Collectors.groupingBy(OrderEvent::getOrderId));
        Map<UUID, Payment> paymentOf = payments.ofOrders(ids);
        Map<UUID, Business> shops = byId(businesses.findAllById(
                orders.stream().map(Order::getBusinessId).collect(Collectors.toSet())), Business::getId);
        Map<UUID, User> customers = byId(users.findAllById(
                orders.stream().map(Order::getCustomerId).filter(java.util.Objects::nonNull)
                        .collect(Collectors.toSet())), User::getId);
        Instant now = clock.instant();
        List<OrderResponse> out = new ArrayList<>(orders.size());
        for (Order o : orders) {
            out.add(toResponse(o, linesOf.getOrDefault(o.getId(), List.of()),
                    eventsOf.getOrDefault(o.getId(), List.of()), paymentOf.get(o.getId()),
                    shops.get(o.getBusinessId()),
                    o.getCustomerId() == null ? null : customers.get(o.getCustomerId()), now));
        }
        return out;
    }

    private OrderResponse toResponse(Order o, List<OrderLine> ls, List<OrderEvent> es, Payment p, Business b, User c,
            Instant now) {
        Instant deadline = o.getPlacedAt() == null ? null : o.getPlacedAt().plus(props.customerCancelWindow());
        boolean canCancel = o.getStatus() == OrderStatus.NEW && deadline != null && !now.isAfter(deadline);
        Instant autoCancelAt = o.getStatus() == OrderStatus.NEW && o.getPlacedAt() != null
                ? o.getPlacedAt().plus(props.autoCancelAfter()) : null;
        return new OrderResponse(
                o.getId().toString(),
                o.getNumber(),
                o.getCheckoutId() == null ? null : o.getCheckoutId().toString(),
                o.getBusinessId().toString(),
                b == null ? null : new OrderResponse.Shop(b.getId().toString(), b.getSlug(), b.getName(), b.getPhone(),
                        b.getStreet(), b.getDistrict()),
                c != null ? new OrderResponse.Customer(c.getId().toString(), c.getName(), c.getPhone(), c.getEmail())
                        // A manual order: the contact the shop took down.
                        : o.getContactName() == null ? null
                        : new OrderResponse.Customer(null, o.getContactName(), o.getContactPhone(), null),
                o.getStatus().name(),
                o.getMethod().name(),
                ls.stream().map(l -> new OrderResponse.Line(l.getVariantId().toString(), l.getProductId().toString(),
                        l.getProductSlug(), l.getTitle(), l.getVariantName(), l.getOptions(), l.getSku(), l.getQty(),
                        l.getListPrice(), l.getUnitPrice())).toList(),
                o.getSubtotal(),
                o.getDiscount(),
                o.getPromoDiscount(),
                o.getPromoCode(),
                o.getDeliveryFee(),
                o.getTotal(),
                PaymentService.toOrderPayment(p),
                p == null || p.getIntentId() == null ? null : p.getIntentId().toString(),
                o.getAddress(),
                o.getDeliveryWindow(),
                o.getScheduledFor(),
                o.getNote(),
                o.getDeliveryBy() == null ? null : o.getDeliveryBy().name(),
                o.getRider(),
                es.stream().map(e -> new OrderResponse.Event(e.getStatus().name(), e.getAt(), e.getNote())).toList(),
                o.getCreatedAt(),
                o.getPlacedAt(),
                o.getAcceptedAt(),
                o.getPackedAt(),
                o.getShippedAt(),
                o.getFulfilledAt(),
                o.getCancelledAt(),
                o.getReturnedAt(),
                o.getCancelReason(),
                deadline,
                canCancel,
                autoCancelAt,
                o.isReviewed(), o.getSource().name());
    }

    private static <T> Map<UUID, T> byId(Collection<T> rows, Function<T, UUID> id) {
        return rows.stream().collect(Collectors.toMap(id, Function.identity(), (a, b) -> a));
    }
}
