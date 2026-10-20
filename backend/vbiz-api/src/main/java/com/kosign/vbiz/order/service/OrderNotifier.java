package com.kosign.vbiz.order.service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

import com.kosign.vbiz.common.helper.Money;
import com.kosign.vbiz.notification.domain.NotificationKind;
import com.kosign.vbiz.notification.service.NotificationService;
import com.kosign.vbiz.notification.sse.StreamEvent;
import com.kosign.vbiz.order.domain.FulfilmentMethod;
import com.kosign.vbiz.order.domain.Order;
import com.kosign.vbiz.payment.domain.PaymentStatus;

import lombok.RequiredArgsConstructor;

/** Inbox entries and live events for order changes (sent once the transaction commits). */
@Component
@RequiredArgsConstructor
public class OrderNotifier {

    private final NotificationService notifications;
    private final ApplicationEventPublisher events;

    /** Every change: the customer's stream, and the shop's once the order is placed. */
    public void changed(Order o, PaymentStatus paymentStatus) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", o.getId().toString());
        data.put("number", o.getNumber());
        data.put("businessId", o.getBusinessId().toString());
        data.put("status", o.getStatus().name());
        if (paymentStatus != null) {
            data.put("paymentStatus", paymentStatus.name());
        }
        // A manual order has no account to tell.
        events.publishEvent(new StreamEvent(o.getCustomerId() == null ? Set.of() : Set.of(o.getCustomerId()),
                o.getPlacedAt() == null ? Set.of() : Set.of(o.getBusinessId()), "order", data));
    }

    public void newOrder(Order o, String customerName) {
        notifications.toBusiness(o.getBusinessId(), NotificationKind.NEW_ORDER,
                Map.of("number", o.getNumber(), "name", customerName, "amount", Money.usd(o.getTotal()).toPlainString()),
                sellerRoute(o));
    }

    public void accepted(Order o, String shopName) {
        toCustomer(o, NotificationKind.ORDER_ACCEPTED, shopName, Map.of());
    }

    public void ready(Order o, String shopName) {
        if (o.getMethod() == FulfilmentMethod.PICKUP) {
            toCustomer(o, NotificationKind.ORDER_READY_PICKUP, shopName, Map.of());
        }
    }

    public void onTheWay(Order o, String shopName) {
        toCustomer(o, NotificationKind.ORDER_ON_THE_WAY, shopName,
                o.getRider() == null ? Map.of() : Map.of("rider", o.getRider().name()));
    }

    public void fulfilled(Order o, String shopName) {
        toCustomer(o, o.getMethod() == FulfilmentMethod.PICKUP ? NotificationKind.ORDER_PICKED_UP
                : NotificationKind.ORDER_DELIVERED, shopName, Map.of());
    }

    public void returned(Order o, String shopName) {
        toCustomer(o, NotificationKind.ORDER_RETURNED, shopName,
                Map.of("amount", Money.usd(o.getTotal()).toPlainString()));
    }

    /** {@code toCustomer}/{@code toShop}: who should hear about it (not the one who did it). */
    public void cancelled(Order o, String shopName, boolean toCustomer, boolean toShop) {
        if (toCustomer) {
            toCustomer(o, NotificationKind.ORDER_CANCELLED, shopName, Map.of("reason", o.getCancelReason()));
        }
        if (toShop && o.getPlacedAt() != null) {
            notifications.toBusiness(o.getBusinessId(), NotificationKind.ORDER_CANCELLED,
                    Map.of("number", o.getNumber(), "reason", o.getCancelReason()), sellerRoute(o));
        }
    }

    private void toCustomer(Order o, String kind, String shopName, Map<String, String> extra) {
        if (o.getCustomerId() == null) {
            return; // a manual order: the shop contacts the customer itself
        }
        Map<String, String> params = new LinkedHashMap<>();
        params.put("number", o.getNumber());
        params.put("shop", shopName);
        params.putAll(extra);
        notifications.toUser(o.getCustomerId(), kind, params, "/orders/" + o.getNumber());
    }

    static String sellerRoute(Order o) {
        return "/seller/orders?order=" + o.getId();
    }
}
