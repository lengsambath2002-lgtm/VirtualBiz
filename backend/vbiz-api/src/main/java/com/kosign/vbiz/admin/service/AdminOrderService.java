package com.kosign.vbiz.admin.service;

import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.admin.domain.AuditTarget;
import com.kosign.vbiz.admin.payload.AdminOrderDetail;
import com.kosign.vbiz.admin.payload.AdminOrderRow;
import com.kosign.vbiz.admin.payload.PageResponse;
import com.kosign.vbiz.admin.repository.AdminQueries;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.order.service.OrderService;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;

/**
 * Orders across every shop (docs/api/phase7-admin.md § Orders): search, an order's full record,
 * and support's two dispute tools: cancel before it ships, refund after it arrived.
 */
@Service
@RequiredArgsConstructor
public class AdminOrderService {

    private final AdminAccess access;
    private final AdminQueries queries;
    private final AuditLog audit;
    private final OrderService orders;
    private final EntityManager em;

    @Transactional(readOnly = true)
    public PageResponse<AdminOrderRow> list(String q, String status, UUID businessId, UUID customerId, Integer page,
            Integer size) {
        access.require();
        int[] p = AuditLog.paging(page, size);
        return queries.orders(new AdminQueries.OrderFilter(q, status, businessId, customerId), p[0], p[1]);
    }

    @Transactional(readOnly = true)
    public AdminOrderDetail get(String number) {
        access.require();
        return detail(id(number));
    }

    @Transactional
    public AdminOrderDetail cancel(String number, String rawReason) {
        AdminAccess.Admin admin = access.require();
        String reason = AuditLog.requireReason(rawReason);
        UUID id = id(number);
        var o = orders.adminCancel(id, admin.id(), reason);
        audit.record(admin, AuditLog.ORDER_CANCELLED, AuditTarget.ORDER, o.number(), o.number(), reason,
                Map.of("total", o.total()));
        return detail(id);
    }

    @Transactional
    public AdminOrderDetail refund(String number, String rawReason, boolean restock) {
        AdminAccess.Admin admin = access.require();
        String reason = AuditLog.requireReason(rawReason);
        UUID id = id(number);
        var o = orders.adminRefund(id, admin.id(), reason, restock);
        audit.record(admin, AuditLog.ORDER_REFUNDED, AuditTarget.ORDER, o.number(), o.number(), reason,
                Map.of("total", o.total(), "restock", restock));
        return detail(id);
    }

    private UUID id(String number) {
        return queries.orderId(number).orElseThrow(() -> new BusinessException(StatusCode.ORDER_NOT_FOUND));
    }

    private AdminOrderDetail detail(UUID id) {
        em.flush(); // the reads below are SQL: let them see the change just made
        AdminOrderDetail d = queries.order(id).orElseThrow(() -> new BusinessException(StatusCode.ORDER_NOT_FOUND));
        return new AdminOrderDetail(d.order(), d.customerEmail(), d.customerPhone(), d.shopPhone(), d.address(),
                d.note(), d.subtotal(), d.discount(), d.promoDiscount(), d.promoCode(), d.deliveryFee(), d.lines(),
                d.events(), d.payment(), audit.of(AuditTarget.ORDER, d.order().number()));
    }
}
