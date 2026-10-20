package com.kosign.vbiz.order.service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.business.domain.Business;
import com.kosign.vbiz.business.domain.BusinessType;
import com.kosign.vbiz.business.service.WorkspaceAccess;
import com.kosign.vbiz.catalog.domain.Product;
import com.kosign.vbiz.catalog.domain.ProductVariant;
import com.kosign.vbiz.catalog.mapper.CatalogMapper;
import com.kosign.vbiz.catalog.repository.ProductRepository;
import com.kosign.vbiz.catalog.repository.ProductVariantRepository;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.helper.Money;
import com.kosign.vbiz.common.helper.PhoneNumbers;
import com.kosign.vbiz.customer.service.ClientService;
import com.kosign.vbiz.delivery.service.DeliveryFees;
import com.kosign.vbiz.inventory.domain.StockReason;
import com.kosign.vbiz.inventory.service.StockWrite;
import com.kosign.vbiz.inventory.service.StockWriter;
import com.kosign.vbiz.meta.service.ReferenceDataService;
import com.kosign.vbiz.order.domain.FulfilmentMethod;
import com.kosign.vbiz.order.domain.Order;
import com.kosign.vbiz.order.domain.OrderAddress;
import com.kosign.vbiz.order.domain.OrderEvent;
import com.kosign.vbiz.order.domain.OrderLine;
import com.kosign.vbiz.order.domain.OrderSource;
import com.kosign.vbiz.order.domain.OrderStatus;
import com.kosign.vbiz.order.payload.OrderInputs;
import com.kosign.vbiz.order.payload.OrderResponse;
import com.kosign.vbiz.order.repository.OrderEventRepository;
import com.kosign.vbiz.order.repository.OrderLineRepository;
import com.kosign.vbiz.order.repository.OrderRepository;
import com.kosign.vbiz.payment.domain.Payment;
import com.kosign.vbiz.payment.domain.PaymentMethod;
import com.kosign.vbiz.payment.service.PaymentService;

import lombok.RequiredArgsConstructor;

/**
 * Manual orders (docs/api/phase8-manual-orders.md): an order a product shop took by phone,
 * Facebook, Telegram or at the counter for delivery or pickup, entered by its staff. It joins the
 * shop's order list already ACCEPTED, takes stock through the stock writer like any order, and
 * links the customer to the shop's clients by phone. The money goes to the shop itself.
 */
@Service
@RequiredArgsConstructor
public class ManualOrderService {

    private final WorkspaceAccess access;
    private final OrderRepository orders;
    private final OrderLineRepository lines;
    private final OrderEventRepository events;
    private final OrderService orderService;
    private final OrderViews views;
    private final OrderNotifier notifier;
    private final ProductRepository products;
    private final ProductVariantRepository variants;
    private final StockWriter writer;
    private final PaymentService payments;
    private final ClientService clients;
    private final ReferenceDataService reference;
    private final Clock clock;

    @Transactional
    public OrderResponse create(OrderInputs.Manual in) {
        WorkspaceAccess.Workspace w = access.member();
        Business shop = w.business();
        if (shop.getType() != BusinessType.PRODUCT) {
            throw new BusinessException(StatusCode.WRONG_BUSINESS_TYPE);
        }
        if (in.source() == OrderSource.ONLINE) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "source",
                    "Where the order came from: PHONE, FACEBOOK, TELEGRAM, WALK_IN or OTHER");
        }
        String name = in.name().trim();
        if (name.length() < 2) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "name", "The customer's name");
        }
        boolean delivery = in.method() == FulfilmentMethod.DELIVERY;
        String phone = in.phone() == null || in.phone().isBlank() ? null : PhoneNumbers.normalizeOrThrow(in.phone());
        if (delivery && phone == null) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "phone", "The rider needs a phone number");
        }
        OrderAddress address = null;
        if (delivery) {
            String line = in.line() == null ? "" : in.line().trim();
            if (line.length() < 3) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "line", "Where to deliver");
            }
            if (in.district() == null || in.district().isBlank()) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "district", "Choose the district");
            }
            address = new OrderAddress("OTHER", name, phone, line, reference.canonicalDistrict(in.district()),
                    blankToNull(in.addressNote()), null, null);
        }

        // The shop's own live products only, at today's price.
        Set<UUID> ids = in.lines().stream().map(OrderInputs.ManualLine::variantId).collect(Collectors.toSet());
        Map<UUID, ProductVariant> vs = variants.findAllById(ids).stream().filter(v -> v.getDeletedAt() == null)
                .collect(Collectors.toMap(ProductVariant::getId, Function.identity()));
        Map<UUID, Product> ps = products.findAllById(vs.values().stream().map(ProductVariant::getProductId)
                .collect(Collectors.toSet())).stream()
                .filter(p -> p.getDeletedAt() == null && p.getBusinessId().equals(shop.getId()))
                .collect(Collectors.toMap(Product::getId, Function.identity()));
        Map<UUID, Integer> qty = new LinkedHashMap<>();
        for (int i = 0; i < in.lines().size(); i++) {
            OrderInputs.ManualLine l = in.lines().get(i);
            ProductVariant v = vs.get(l.variantId());
            if (v == null || !ps.containsKey(v.getProductId())) {
                throw BusinessException.withDetail(StatusCode.VARIANT_NOT_FOUND, "lines[" + i + "]",
                        "Not one of this shop's products");
            }
            qty.merge(l.variantId(), l.qty(), Integer::sum);
        }
        BigDecimal subtotal = BigDecimal.ZERO;
        for (Map.Entry<UUID, Integer> e : qty.entrySet()) {
            subtotal = subtotal.add(Money.usd(vs.get(e.getKey()).getPrice()).multiply(BigDecimal.valueOf(e.getValue())));
        }
        subtotal = Money.usd(subtotal);
        BigDecimal discount = in.discount() == null ? Money.ZERO : Money.usd(in.discount());
        if (discount.compareTo(subtotal) > 0) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "discount", "More than the items cost");
        }
        BigDecimal fee = !delivery ? Money.ZERO
                : in.deliveryFee() != null ? Money.usd(in.deliveryFee())
                : Money.usd(DeliveryFees.fee(shop.getProductSettings(), address.district(), subtotal.subtract(discount),
                        FulfilmentMethod.DELIVERY));
        BigDecimal total = Money.usd(subtotal.subtract(discount).add(fee));
        if (total.signum() <= 0) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "lines", "Nothing to charge for");
        }

        String number = String.format("VB-%05d", orders.nextNumber());
        List<StockWrite> writes = new ArrayList<>();
        List<UUID> order = new ArrayList<>(qty.keySet());
        for (UUID id : order) {
            writes.add(new StockWrite(shop.getId(), id, -qty.get(id), StockReason.ORDER_SALE, w.userId(),
                    w.actorName(), number, false));
        }
        writer.writeAll(writes, k -> "lines[" + k + "]");

        Instant now = clock.instant();
        Order o = new Order();
        o.setNumber(number);
        o.setBusinessId(shop.getId());
        o.setSource(in.source());
        o.setContactName(name);
        o.setContactPhone(phone);
        o.setStatus(OrderStatus.ACCEPTED);
        o.setMethod(in.method());
        o.setAddress(address);
        o.setNote(blankToNull(in.note()));
        o.setSubtotal(subtotal);
        o.setDiscount(discount);
        o.setPromoDiscount(Money.ZERO);
        o.setDeliveryFee(fee);
        o.setTotal(total);
        o.setPlacedAt(now);
        o.setAcceptedAt(now);
        o = orders.saveAndFlush(o);

        int pos = 0;
        List<OrderLine> rows = new ArrayList<>();
        for (UUID id : order) {
            ProductVariant v = vs.get(id);
            Product p = ps.get(v.getProductId());
            BigDecimal unit = Money.usd(v.getPrice());
            OrderLine r = new OrderLine();
            r.setOrderId(o.getId());
            r.setVariantId(id);
            r.setProductId(p.getId());
            r.setProductSlug(p.getSlug());
            r.setTitle(p.getTitle());
            r.setVariantName(CatalogMapper.variantName(v.getOptionValues()));
            r.setOptions(CatalogMapper.optionMap(p.getOptions(), v.getOptionValues()));
            r.setSku(v.getSku() == null ? "" : v.getSku());
            r.setQty(qty.get(id));
            r.setListPrice(v.getCompareAt() != null && v.getCompareAt().compareTo(unit) > 0 ? Money.usd(v.getCompareAt())
                    : unit);
            r.setUnitPrice(unit);
            r.setPosition(pos++);
            rows.add(r);
        }
        lines.saveAll(rows);
        // The timeline: taken by this staff member and accepted at once (the channel is o.source).
        event(o, OrderStatus.NEW, w.userId(), null, now);
        event(o, OrderStatus.ACCEPTED, w.userId(), null, now);
        lines.flush();
        orderService.adjustSold(o, +1);

        boolean paid = in.payment() != OrderInputs.ManualPayment.COD;
        Payment pay = payments.createManual(o.getId(),
                in.payment() == OrderInputs.ManualPayment.PAID_KHQR ? PaymentMethod.KHQR : PaymentMethod.CASH, total, paid);
        if (phone != null) {
            clients.linkOrderCustomer(shop.getId(), null, name, phone, null, address == null ? null : address.district());
        }
        notifier.changed(o, pay.getStatus());
        return views.view(o);
    }

    private void event(Order o, OrderStatus status, UUID by, String note, Instant at) {
        OrderEvent e = new OrderEvent();
        e.setOrderId(o.getId());
        e.setStatus(status);
        e.setByUserId(by);
        e.setNote(note);
        e.setAt(at);
        events.save(e);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
