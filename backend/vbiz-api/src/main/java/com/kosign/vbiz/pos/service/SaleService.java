package com.kosign.vbiz.pos.service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.PageRequest;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.payment.domain.PaymentMethod;
import com.kosign.vbiz.pos.repository.SaleSpecs;
import com.kosign.vbiz.common.list.PageResponse;
import com.kosign.vbiz.common.list.PageQuery;
import com.kosign.vbiz.common.list.DayRange;
import com.kosign.vbiz.booking.domain.Appointment;
import com.kosign.vbiz.booking.service.AppointmentService;
import com.kosign.vbiz.booking.service.Availability;
import com.kosign.vbiz.business.domain.BusinessType;
import com.kosign.vbiz.business.domain.ShopPolicy;
import com.kosign.vbiz.business.repository.BusinessMemberRepository;
import com.kosign.vbiz.business.service.WorkspaceAccess.Workspace;
import com.kosign.vbiz.business.service.WorkspaceAccess;
import com.kosign.vbiz.catalog.domain.ServiceItem;
import com.kosign.vbiz.catalog.repository.ProductVariantRepository;
import com.kosign.vbiz.catalog.repository.ServiceItemRepository;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.helper.Money;
import com.kosign.vbiz.customer.service.ClientService;
import com.kosign.vbiz.inventory.domain.StockReason;
import com.kosign.vbiz.inventory.service.StockWrite;
import com.kosign.vbiz.inventory.service.StockWriter;
import com.kosign.vbiz.notification.sse.StreamEvent;
import com.kosign.vbiz.pos.domain.CashTender;
import com.kosign.vbiz.pos.domain.Sale;
import com.kosign.vbiz.pos.domain.SaleLine;
import com.kosign.vbiz.pos.domain.SalePayment;
import com.kosign.vbiz.pos.payload.SaleInput;
import com.kosign.vbiz.pos.payload.SaleResponse;
import com.kosign.vbiz.pos.repository.SaleLineRepository;
import com.kosign.vbiz.pos.repository.SalePaymentRepository;
import com.kosign.vbiz.pos.repository.SaleRepository;

import lombok.RequiredArgsConstructor;

/**
 * The provider's checkout sales (docs/api/phase4-bookings-provider.md § Sales). Totals are checked
 * here; retail lines take stock through {@link StockWriter}; an appointment sale completes it.
 */
@Service
@RequiredArgsConstructor
public class SaleService {

    static final int DEFAULT_DAYS = 90;
    static final int MAX_DAYS = 400;

    private final SaleRepository sales;
    private final SaleLineRepository lines;
    private final SalePaymentRepository payments;
    private final WorkspaceAccess access;
    private final AppointmentService calendar;
    private final ClientService clients;
    private final ServiceItemRepository services;
    private final ProductVariantRepository variants;
    private final BusinessMemberRepository members;
    private final StockWriter writer;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    @Transactional(readOnly = true)
    public List<SaleResponse> list(LocalDate from, LocalDate to) {
        Workspace w = workspace();
        LocalDate today = LocalDate.now(clock.withZone(Availability.PHNOM_PENH));
        LocalDate t = to == null ? today : to;
        LocalDate f = from == null ? t.minusDays(DEFAULT_DAYS) : from;
        if (t.isBefore(f) || f.plusDays(MAX_DAYS).isBefore(t)) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "to", "from ≤ to, at most 400 days");
        }
        return views(sales.ofBusiness(w.businessId(), Availability.instantOf(f, 0),
                Availability.instantOf(t.plusDays(1), 0)));
    }

    /** Every sale, a page at a time, filtered (docs/api/phase16-shop-lists.md). */
    @Transactional(readOnly = true)
    public PageResponse<SaleResponse> history(String q, PaymentMethod pay, String cashier, String refunded,
            LocalDate from, LocalDate to, String sort, Integer page, Integer size) {
        Workspace w = workspace();
        PageQuery pq = PageQuery.of(page, size, sort, SaleSpecs.SORTS, "-at", null);
        var result = sales.findAll(SaleSpecs.history(w.businessId(), false, q, pay, cashier, refunded,
                DayRange.of(from, to, 3660)), PageRequest.of(pq.page(), pq.size(), SaleSpecs.sort(pq)));
        return new PageResponse<>(views(result.getContent()), result.getTotalElements(), pq.page(), pq.size());
    }

    @Transactional(readOnly = true)
    public SaleResponse get(String ref) {
        Workspace w = workspace();
        return views(List.of(shopSale(w, ref))).get(0);
    }

    @Transactional
    public SaleResponse create(SaleInput in) {
        Workspace w = workspace();
        UUID bid = w.businessId();
        BigDecimal subtotal = Money.ZERO;
        for (int i = 0; i < in.lines().size(); i++) {
            SaleInput.Line l = in.lines().get(i);
            String at = "lines[" + i + "]";
            if (l.serviceId() != null && l.variantId() != null) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, at, "A service or an item, not both");
            }
            if (l.serviceId() != null && services.findByIdAndBusinessIdAndDeletedAtIsNull(l.serviceId(), bid).isEmpty()) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, at + ".serviceId", "Not a service of this shop");
            }
            if (l.variantId() != null && variants.findByIdAndBusinessId(l.variantId(), bid)
                    .filter(v -> v.getDeletedAt() == null).isEmpty()) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, at + ".variantId", "Not an item of this shop");
            }
            if (l.staffId() != null && members.findById(l.staffId()).filter(m -> m.getBusinessId().equals(bid)).isEmpty()) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, at + ".staffId", "Not a member of this shop");
            }
            subtotal = subtotal.add(Money.usd(l.unitPrice()).multiply(BigDecimal.valueOf(l.qty())));
        }
        subtotal = Money.usd(subtotal);
        BigDecimal discount = Money.usd(in.discount());
        BigDecimal tip = Money.usd(in.tip());
        if (discount.compareTo(subtotal) > 0) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "discount", "More than the subtotal");
        }
        BigDecimal total = Money.usd(subtotal.subtract(discount).add(tip));
        // Only the methods this shop takes at the counter (its policy).
        ShopPolicy policy = ShopPolicy.of(w.business().getPolicy());
        for (int i = 0; i < in.payments().size(); i++) {
            if (!policy.accepts(in.payments().get(i).method().name())) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "payments[" + i + "].method",
                        "This shop doesn't take this payment method");
            }
        }
        BigDecimal paid = in.payments().stream().map(p -> Money.usd(p.amount())).reduce(Money.ZERO, BigDecimal::add);
        if (paid.compareTo(total) != 0) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "payments",
                    "The payments must add up to " + total.toPlainString());
        }
        UUID clientId = in.clientId() == null ? null : clients.require(bid, in.clientId()).getId();

        Sale s = new Sale();
        s.setNumber(String.format(Locale.ROOT, "S-%05d", sales.nextNumber()));
        s.setBusinessId(bid);
        s.setAppointmentId(in.appointmentId());
        s.setClientId(clientId);
        s.setSubtotal(subtotal);
        s.setDiscount(discount);
        s.setTip(tip);
        s.setTotal(total);
        if (in.cash() != null && in.cash().usd() != null) {
            s.setCash(new CashTender(Money.usd(in.cash().usd()), in.cash().khr() == null ? 0L : in.cash().khr(),
                    in.cash().change() == null ? null : Money.usd(in.cash().change())));
        }
        s.setByUserId(w.userId());
        s.setByName(w.actorName());
        s.setAt(clock.instant());
        s = sales.saveAndFlush(s);

        List<StockWrite> stock = new ArrayList<>();
        List<Integer> stockLine = new ArrayList<>();
        Map<UUID, Integer> served = new HashMap<>();
        for (int i = 0; i < in.lines().size(); i++) {
            SaleInput.Line l = in.lines().get(i);
            SaleLine row = new SaleLine();
            row.setSaleId(s.getId());
            row.setPosition(i);
            row.setServiceId(l.serviceId());
            row.setVariantId(l.variantId());
            row.setTitle(l.title().trim());
            row.setQty(l.qty());
            row.setUnitPrice(Money.usd(l.unitPrice()));
            row.setStaffId(l.staffId());
            lines.save(row);
            if (l.variantId() != null) {
                stock.add(new StockWrite(bid, l.variantId(), -l.qty(), StockReason.POS_SALE, w.userId(), w.actorName(),
                        s.getNumber(), false));
                stockLine.add(i);
            }
            if (l.serviceId() != null) {
                served.merge(l.serviceId(), l.qty(), Integer::sum);
            }
        }
        for (int i = 0; i < in.payments().size(); i++) {
            SalePayment p = new SalePayment();
            p.setSaleId(s.getId());
            p.setPosition(i);
            p.setMethod(in.payments().get(i).method());
            p.setAmount(Money.usd(in.payments().get(i).amount()));
            payments.save(p);
        }
        if (!stock.isEmpty()) {
            writer.writeAll(stock, i -> "lines[" + stockLine.get(i) + "]");
        }
        for (ServiceItem item : services.findAllById(served.keySet())) {
            item.setSoldCount(item.getSoldCount() + served.get(item.getId()));
        }
        if (in.appointmentId() != null) {
            String method = in.payments().size() == 1 ? in.payments().get(0).method().name() : "SPLIT";
            Appointment a = calendar.complete(w, in.appointmentId(), s.getId(), total.toPlainString(), method);
            if (s.getClientId() == null) {
                s.setClientId(a.getClientId());
            }
        }
        events.publishEvent(StreamEvent.toBusiness(bid, "sale", Map.of("id", s.getId().toString(),
                "number", s.getNumber())));
        return views(List.of(s)).get(0);
    }

    // ── internals ─────────────────────────────────────────────────────────────────────

    private Workspace workspace() {
        Workspace w = access.member();
        WorkspaceAccess.requireType(w, BusinessType.SERVICE);
        return w;
    }

    private Sale shopSale(Workspace w, String ref) {
        String r = ref == null ? "" : ref.trim();
        Optional<Sale> s = r.toUpperCase(Locale.ROOT).startsWith("S-") ? sales.findByNumber(r.toUpperCase(Locale.ROOT))
                : parseUuid(r).flatMap(sales::findById);
        return s.filter(x -> x.getBusinessId().equals(w.businessId()))
                .orElseThrow(() -> new BusinessException(StatusCode.SALE_NOT_FOUND));
    }

    private List<SaleResponse> views(List<Sale> rows) {
        if (rows.isEmpty()) {
            return List.of();
        }
        List<UUID> ids = rows.stream().map(Sale::getId).toList();
        Map<UUID, List<SaleResponse.Line>> ls = new HashMap<>();
        for (SaleLine l : lines.findBySaleIdInOrderByPositionAsc(ids)) {
            ls.computeIfAbsent(l.getSaleId(), k -> new ArrayList<>()).add(new SaleResponse.Line(str(l.getServiceId()),
                    str(l.getVariantId()), l.getTitle(), l.getQty(), l.getUnitPrice(), str(l.getStaffId())));
        }
        Map<UUID, List<SaleResponse.Payment>> ps = new HashMap<>();
        for (SalePayment p : payments.findBySaleIdInOrderByPositionAsc(ids)) {
            ps.computeIfAbsent(p.getSaleId(), k -> new ArrayList<>())
                    .add(new SaleResponse.Payment(p.getMethod(), p.getAmount()));
        }
        return rows.stream().map(s -> new SaleResponse(s.getId().toString(), s.getNumber(),
                s.getBusinessId().toString(), str(s.getAppointmentId()), str(s.getClientId()),
                ls.getOrDefault(s.getId(), List.of()), s.getSubtotal(), s.getDiscount(), s.getTip(), s.getTotal(),
                ps.getOrDefault(s.getId(), List.of()), s.getCash(), s.getByName(), s.getAt())).toList();
    }

    private static String str(UUID id) {
        return id == null ? null : id.toString();
    }

    private static Optional<UUID> parseUuid(String s) {
        try {
            return Optional.of(UUID.fromString(s));
        } catch (IllegalArgumentException ex) {
            return Optional.empty();
        }
    }
}
