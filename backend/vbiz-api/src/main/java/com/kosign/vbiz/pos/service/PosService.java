package com.kosign.vbiz.pos.service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.activity.service.ShopActivityLog;
import com.kosign.vbiz.pos.repository.SaleSpecs;
import com.kosign.vbiz.common.list.PageResponse;
import com.kosign.vbiz.common.list.PageQuery;
import com.kosign.vbiz.common.list.DayRange;
import com.kosign.vbiz.booking.service.Availability;
import com.kosign.vbiz.business.domain.BusinessType;
import com.kosign.vbiz.business.domain.ShopPolicy;
import com.kosign.vbiz.business.service.WorkspaceAccess.Workspace;
import com.kosign.vbiz.business.service.WorkspaceAccess;
import com.kosign.vbiz.catalog.domain.Product;
import com.kosign.vbiz.catalog.domain.ProductVariant;
import com.kosign.vbiz.catalog.mapper.CatalogMapper;
import com.kosign.vbiz.catalog.repository.ProductRepository;
import com.kosign.vbiz.catalog.repository.ProductVariantRepository;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.helper.Money;
import com.kosign.vbiz.inventory.domain.StockReason;
import com.kosign.vbiz.inventory.service.StockWrite;
import com.kosign.vbiz.inventory.service.StockWriter;
import com.kosign.vbiz.notification.sse.StreamEvent;
import com.kosign.vbiz.payment.domain.PaymentMethod;
import com.kosign.vbiz.pos.domain.CashTender;
import com.kosign.vbiz.pos.domain.PosCashMove;
import com.kosign.vbiz.pos.domain.PosShift;
import com.kosign.vbiz.pos.domain.Sale;
import com.kosign.vbiz.pos.domain.SaleLine;
import com.kosign.vbiz.pos.domain.SalePayment;
import com.kosign.vbiz.pos.domain.SaleRefund;
import com.kosign.vbiz.pos.domain.SaleRefundLine;
import com.kosign.vbiz.pos.payload.PosInputs;
import com.kosign.vbiz.pos.payload.PosSaleResponse;
import com.kosign.vbiz.pos.payload.SaleResponse;
import com.kosign.vbiz.pos.payload.ShiftResponse;
import com.kosign.vbiz.pos.repository.PosCashMoveRepository;
import com.kosign.vbiz.pos.repository.PosShiftRepository;
import com.kosign.vbiz.pos.repository.SaleLineRepository;
import com.kosign.vbiz.pos.repository.SalePaymentRepository;
import com.kosign.vbiz.pos.repository.SaleRefundLineRepository;
import com.kosign.vbiz.pos.repository.SaleRefundRepository;
import com.kosign.vbiz.pos.repository.SaleRepository;

import lombok.RequiredArgsConstructor;

/**
 * The Seller register (docs/api/phase5-pos-promotions-reviews.md § POS): shifts and the cash
 * drawer, counter sales (R- receipts) and refunds. Stock changes go through {@link StockWriter}.
 */
@Service
@RequiredArgsConstructor
public class PosService {

    static final Duration OFFLINE_LIMIT = Duration.ofDays(7);
    static final int DEFAULT_DAYS = 31;

    private final ShopActivityLog activity;
    private final PosShiftRepository shifts;
    private final PosCashMoveRepository moves;
    private final SaleRepository sales;
    private final SaleLineRepository lines;
    private final SalePaymentRepository payments;
    private final SaleRefundRepository refunds;
    private final SaleRefundLineRepository refundLines;
    private final ProductVariantRepository variants;
    private final ProductRepository products;
    private final StockWriter writer;
    private final WorkspaceAccess access;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    // ── Shifts ────────────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public ShiftResponse openShift() {
        Workspace w = workspace();
        return shifts.findOpen(w.businessId()).map(this::view).orElse(null);
    }

    @Transactional
    public ShiftResponse open(PosInputs.OpenShift in) {
        Workspace w = workspace();
        if (shifts.lockOpen(w.businessId()).isPresent()) {
            throw new BusinessException(StatusCode.SHIFT_ALREADY_OPEN);
        }
        PosShift s = new PosShift();
        s.setBusinessId(w.businessId());
        s.setOpenedBy(w.userId());
        s.setOpenedByName(w.actorName());
        s.setOpenedAt(clock.instant());
        s.setFloatUsd(Money.usd(in.floatUsd()));
        s.setFloatKhr(in.floatKhr());
        s = shifts.saveAndFlush(s);
        changed(w, "shift", s.getId());
        return view(s);
    }

    @Transactional
    public ShiftResponse cashMove(PosInputs.CashMove in) {
        Workspace w = workspace();
        PosShift s = requireOpen(w);
        BigDecimal amount = Money.usd(in.amount());
        if (amount.signum() == 0) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "amount", "Not zero");
        }
        if (amount.signum() < 0 && expected(s).add(amount).signum() < 0) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "amount",
                    "More than the cash in the drawer");
        }
        PosCashMove m = new PosCashMove();
        m.setShiftId(s.getId());
        m.setAmount(amount);
        m.setNote(in.note() == null ? "" : in.note().trim());
        m.setByUserId(w.userId());
        m.setByName(w.actorName());
        m.setAt(clock.instant());
        moves.saveAndFlush(m);
        changed(w, "shift", s.getId());
        return view(s);
    }

    @Transactional
    public ShiftResponse close(PosInputs.CloseShift in) {
        Workspace w = workspace();
        PosShift s = requireOpen(w);
        BigDecimal expected = expected(s);
        BigDecimal counted = Money.usd(in.countedUsd());
        s.setClosedAt(clock.instant());
        s.setClosedByName(w.actorName());
        s.setCountedUsd(counted);
        s.setExpectedUsd(expected);
        s.setDifference(Money.usd(counted.subtract(expected)));
        shifts.saveAndFlush(s);
        changed(w, "shift", s.getId());
        return view(s);
    }

    @Transactional(readOnly = true)
    public List<ShiftResponse> closedShifts(Integer limit) {
        Workspace w = workspace();
        int n = limit == null ? 30 : Math.max(1, Math.min(100, limit));
        return shifts.closed(w.businessId(), PageRequest.of(0, n)).stream().map(this::view).toList();
    }

    // ── Sales ─────────────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<PosSaleResponse> list(LocalDate from, LocalDate to) {
        Workspace w = workspace();
        LocalDate today = LocalDate.now(clock.withZone(Availability.PHNOM_PENH));
        LocalDate t = to == null ? today : to;
        LocalDate f = from == null ? t.minusDays(DEFAULT_DAYS) : from;
        if (t.isBefore(f) || f.plusDays(400).isBefore(t)) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "to", "from ≤ to, at most 400 days");
        }
        return views(sales.receipts(w.businessId(), Availability.instantOf(f, 0),
                Availability.instantOf(t.plusDays(1), 0)));
    }

    /** Every sale, a page at a time, filtered (docs/api/phase16-shop-lists.md). */
    @Transactional(readOnly = true)
    public PageResponse<PosSaleResponse> history(String q, PaymentMethod pay, String cashier, String refunded,
            LocalDate from, LocalDate to, String sort, Integer page, Integer size) {
        Workspace w = workspace();
        PageQuery pq = PageQuery.of(page, size, sort, SaleSpecs.SORTS, "-at", null);
        var result = sales.findAll(SaleSpecs.history(w.businessId(), true, q, pay, cashier, refunded,
                DayRange.of(from, to, 3660)), PageRequest.of(pq.page(), pq.size(), SaleSpecs.sort(pq)));
        return new PageResponse<>(views(result.getContent()), result.getTotalElements(), pq.page(), pq.size());
    }

    /** True in {@code created} when this call stored the sale (false: the clientRef was known). */
    public record Rung(PosSaleResponse sale, boolean created) {
    }

    @Transactional
    public Rung ring(PosInputs.Sale in) {
        Workspace w = workspace();
        Optional<Sale> known = sales.findByBusinessIdAndClientRef(w.businessId(), in.clientRef());
        if (known.isPresent()) {
            return new Rung(views(List.of(known.get())).get(0), false);
        }
        Instant now = clock.instant();
        Instant at = in.at() == null || in.at().isAfter(now) ? now : in.at();
        if (at.isBefore(now.minus(OFFLINE_LIMIT))) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "at", "At most 7 days ago");
        }
        PosShift shift = shifts.lockOpen(w.businessId()).filter(s -> !s.getOpenedAt().isAfter(at))
                .or(() -> shifts.openAt(w.businessId(), at).stream().findFirst())
                .orElseThrow(() -> new BusinessException(StatusCode.SHIFT_NOT_FOUND));

        Map<UUID, ProductVariant> vs = new HashMap<>();
        BigDecimal subtotal = Money.ZERO;
        for (int i = 0; i < in.lines().size(); i++) {
            PosInputs.Line l = in.lines().get(i);
            ProductVariant v = variants.findByIdAndBusinessId(l.variantId(), w.businessId())
                    .filter(x -> x.getDeletedAt() == null)
                    .orElseThrow(() -> BusinessException.withDetail(StatusCode.VARIANT_NOT_FOUND,
                            "lines[" + vs.size() + "].variantId", "Not an item of this shop"));
            vs.put(v.getId(), v);
            subtotal = subtotal.add(Money.usd(l.unitPrice()).multiply(BigDecimal.valueOf(l.qty())));
        }
        subtotal = Money.usd(subtotal);
        BigDecimal discount = Money.usd(in.discount());
        if (discount.compareTo(subtotal) > 0) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "discount", "More than the subtotal");
        }
        BigDecimal total = Money.usd(subtotal.subtract(discount));
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

        Sale s = new Sale();
        s.setNumber(String.format(Locale.ROOT, "R-%05d", sales.nextReceipt()));
        s.setBusinessId(w.businessId());
        s.setClientRef(in.clientRef());
        s.setShiftId(shift.getId());
        s.setSubtotal(subtotal);
        s.setDiscount(discount);
        s.setDiscountReason(blankToNull(in.discountReason()));
        s.setTip(Money.ZERO);
        s.setTotal(total);
        s.setCustomerName(blankToNull(in.customerName()));
        if (in.cash() != null && in.cash().usd() != null) {
            s.setCash(new CashTender(Money.usd(in.cash().usd()), in.cash().khr() == null ? 0L : in.cash().khr(),
                    in.cash().change() == null ? null : Money.usd(in.cash().change())));
        }
        s.setByUserId(w.userId());
        s.setByName(w.actorName());
        s.setAt(at);
        s = sales.saveAndFlush(s);

        Map<UUID, Product> ps = byId(products.findAllById(vs.values().stream().map(ProductVariant::getProductId)
                .collect(Collectors.toSet())), Product::getId);
        List<StockWrite> writes = new ArrayList<>();
        for (int i = 0; i < in.lines().size(); i++) {
            PosInputs.Line l = in.lines().get(i);
            ProductVariant v = vs.get(l.variantId());
            Product p = ps.get(v.getProductId());
            SaleLine row = new SaleLine();
            row.setSaleId(s.getId());
            row.setPosition(i);
            row.setVariantId(v.getId());
            row.setProductId(v.getProductId());
            row.setTitle(p == null ? "" : p.getTitle());
            row.setVariantName(CatalogMapper.variantName(v.getOptionValues()));
            row.setQty(l.qty());
            row.setUnitPrice(Money.usd(l.unitPrice()));
            lines.save(row);
            writes.add(new StockWrite(w.businessId(), v.getId(), -l.qty(), StockReason.POS_SALE, w.userId(),
                    w.actorName(), s.getNumber(), false));
        }
        for (int i = 0; i < in.payments().size(); i++) {
            SalePayment p = new SalePayment();
            p.setSaleId(s.getId());
            p.setPosition(i);
            p.setMethod(in.payments().get(i).method());
            p.setAmount(Money.usd(in.payments().get(i).amount()));
            payments.save(p);
        }
        writer.writeAll(writes, i -> "lines[" + i + "]");
        changed(w, "sale", s.getId());
        return new Rung(views(List.of(s)).get(0), true);
    }

    @Transactional
    public PosSaleResponse refund(String ref, PosInputs.Refund in) {
        Workspace w = workspace();
        Sale s = sales.lockById(shopSale(w, ref).getId()).orElseThrow();
        List<SaleLine> sold = lines.findBySaleIdInOrderByPositionAsc(List.of(s.getId()));
        List<SaleRefund> earlier = refunds.findBySaleIdInOrderByAtAsc(List.of(s.getId()));
        Map<UUID, Integer> left = new LinkedHashMap<>();
        sold.stream().filter(l -> l.getVariantId() != null).forEach(l -> left.merge(l.getVariantId(), l.getQty(), Integer::sum));
        if (!earlier.isEmpty()) {
            for (SaleRefundLine rl : refundLines.findByRefundIdIn(earlier.stream().map(SaleRefund::getId).toList())) {
                left.merge(rl.getVariantId(), -rl.getQty(), Integer::sum);
            }
        }
        Map<UUID, Integer> asked = new LinkedHashMap<>();
        in.lines().forEach(l -> asked.merge(l.variantId(), l.qty(), Integer::sum));
        for (Map.Entry<UUID, Integer> e : asked.entrySet()) {
            if (e.getValue() > left.getOrDefault(e.getKey(), 0)) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "lines",
                        "More than was sold and not yet refunded");
            }
        }
        BigDecimal refunded = earlier.stream().map(SaleRefund::getAmount).reduce(Money.ZERO, BigDecimal::add);
        BigDecimal amount = Money.usd(in.amount());
        if (amount.compareTo(s.getTotal().subtract(refunded)) > 0) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "amount",
                    "More than is left to refund");
        }
        Optional<PosShift> open = shifts.lockOpen(w.businessId());
        if (in.method() == PaymentMethod.CASH && open.isPresent() && expected(open.get()).compareTo(amount) < 0) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "amount",
                    "More than the cash in the drawer");
        }
        boolean restock = Boolean.TRUE.equals(in.restock());
        SaleRefund r = new SaleRefund();
        r.setSaleId(s.getId());
        r.setShiftId(open.map(PosShift::getId).orElse(null));
        r.setAmount(amount);
        r.setMethod(in.method());
        r.setRestock(restock);
        r.setByUserId(w.userId());
        r.setByName(w.actorName());
        r.setAt(clock.instant());
        r = refunds.saveAndFlush(r);
        List<StockWrite> writes = new ArrayList<>();
        for (Map.Entry<UUID, Integer> e : asked.entrySet()) {
            SaleRefundLine rl = new SaleRefundLine();
            rl.setRefundId(r.getId());
            rl.setVariantId(e.getKey());
            rl.setQty(e.getValue());
            refundLines.save(rl);
            boolean live = variants.findById(e.getKey()).filter(v -> v.getDeletedAt() == null).isPresent();
            if (restock && live) {
                writes.add(new StockWrite(w.businessId(), e.getKey(), e.getValue(), StockReason.POS_REFUND, w.userId(),
                        w.actorName(), s.getNumber(), false));
            }
        }
        if (!writes.isEmpty()) {
            writer.writeAll(writes, i -> "lines[" + i + "]");
        }
        changed(w, "sale", s.getId());
        activity.record(w, ShopActivityLog.SALE_REFUNDED, "SALE", s.getNumber(), s.getNumber(),
                ShopActivityLog.details("amount", amount, "restock", in.restock()));
        return views(List.of(s)).get(0);
    }

    // ── internals ─────────────────────────────────────────────────────────────────────

    private Workspace workspace() {
        Workspace w = access.member();
        WorkspaceAccess.requireType(w, BusinessType.PRODUCT);
        return w;
    }

    private PosShift requireOpen(Workspace w) {
        return shifts.lockOpen(w.businessId()).orElseThrow(() -> new BusinessException(StatusCode.SHIFT_NOT_FOUND));
    }

    private Sale shopSale(Workspace w, String ref) {
        String r = ref == null ? "" : ref.trim();
        Optional<Sale> s = r.toUpperCase(Locale.ROOT).startsWith("R-") ? sales.findByNumber(r.toUpperCase(Locale.ROOT))
                : parseUuid(r).flatMap(id -> sales.findById(id)
                        .or(() -> sales.findByBusinessIdAndClientRef(w.businessId(), id)));
        return s.filter(x -> x.getBusinessId().equals(w.businessId()) && x.getNumber().startsWith("R-"))
                .orElseThrow(() -> new BusinessException(StatusCode.SALE_NOT_FOUND));
    }

    /** Cash the drawer should hold: float + cash sales − cash refunds + moves. */
    private BigDecimal expected(PosShift s) {
        Totals t = totals(List.of(s)).get(s.getId());
        return t.expected();
    }

    private record Totals(BigDecimal cashSales, BigDecimal cashRefunds, BigDecimal moves, BigDecimal expected,
            List<PosCashMove> moveRows) {
    }

    private Map<UUID, Totals> totals(List<PosShift> rows) {
        List<UUID> ids = rows.stream().map(PosShift::getId).toList();
        Map<UUID, BigDecimal> cash = new HashMap<>();
        List<Sale> ss = sales.findByShiftIdIn(ids);
        Map<UUID, UUID> shiftOfSale = ss.stream().collect(Collectors.toMap(Sale::getId, Sale::getShiftId));
        if (!ss.isEmpty()) {
            for (SalePayment p : payments.findBySaleIdInOrderByPositionAsc(shiftOfSale.keySet())) {
                if (p.getMethod() == PaymentMethod.CASH) {
                    cash.merge(shiftOfSale.get(p.getSaleId()), p.getAmount(), BigDecimal::add);
                }
            }
        }
        Map<UUID, BigDecimal> back = new HashMap<>();
        for (SaleRefund r : refunds.findByShiftIdIn(ids)) {
            if (r.getMethod() == PaymentMethod.CASH) {
                back.merge(r.getShiftId(), r.getAmount(), BigDecimal::add);
            }
        }
        Map<UUID, List<PosCashMove>> mv = new HashMap<>();
        for (PosCashMove m : moves.findByShiftIdInOrderByAtAsc(ids)) {
            mv.computeIfAbsent(m.getShiftId(), k -> new ArrayList<>()).add(m);
        }
        Map<UUID, Totals> out = new HashMap<>();
        for (PosShift s : rows) {
            BigDecimal c = Money.usd(cash.getOrDefault(s.getId(), Money.ZERO));
            BigDecimal b = Money.usd(back.getOrDefault(s.getId(), Money.ZERO));
            List<PosCashMove> ms = mv.getOrDefault(s.getId(), List.of());
            BigDecimal m = Money.usd(ms.stream().map(PosCashMove::getAmount).reduce(Money.ZERO, BigDecimal::add));
            // The riel float counts at the reference rate, as the register shows it.
            BigDecimal khr = BigDecimal.valueOf(s.getFloatKhr()).divide(BigDecimal.valueOf(Money.DEFAULT_KHR_PER_USD), 2,
                    Money.ROUNDING);
            out.put(s.getId(), new Totals(c, b, m, Money.usd(s.getFloatUsd().add(khr).add(c).subtract(b).add(m)), ms));
        }
        return out;
    }

    private ShiftResponse view(PosShift s) {
        Totals t = totals(List.of(s)).get(s.getId());
        return new ShiftResponse(s.getId().toString(), s.getOpenedAt(),
                s.getOpenedBy() == null ? null : s.getOpenedBy().toString(), s.getOpenedByName(), s.getFloatUsd(),
                s.getFloatKhr(), t.moveRows().stream().map(m -> new ShiftResponse.Move(m.getAmount(), m.getNote(),
                        m.getAt(), m.getByName())).toList(),
                t.cashSales(), t.cashRefunds(), s.getClosedAt() == null ? t.expected() : s.getExpectedUsd(),
                s.getClosedAt(), s.getClosedByName(), s.getCountedUsd(), s.getDifference());
    }

    private List<PosSaleResponse> views(List<Sale> rows) {
        if (rows.isEmpty()) {
            return List.of();
        }
        List<UUID> ids = rows.stream().map(Sale::getId).toList();
        Map<UUID, List<PosSaleResponse.Line>> ls = new HashMap<>();
        for (SaleLine l : lines.findBySaleIdInOrderByPositionAsc(ids)) {
            ls.computeIfAbsent(l.getSaleId(), k -> new ArrayList<>()).add(new PosSaleResponse.Line(
                    str(l.getProductId()), str(l.getVariantId()), l.getTitle(), l.getVariantName() == null ? ""
                            : l.getVariantName(), l.getQty(), l.getUnitPrice()));
        }
        Map<UUID, List<SaleResponse.Payment>> ps = new HashMap<>();
        for (SalePayment p : payments.findBySaleIdInOrderByPositionAsc(ids)) {
            ps.computeIfAbsent(p.getSaleId(), k -> new ArrayList<>())
                    .add(new SaleResponse.Payment(p.getMethod(), p.getAmount()));
        }
        List<SaleRefund> rs = refunds.findBySaleIdInOrderByAtAsc(ids);
        Map<UUID, List<PosSaleResponse.RefundLine>> rls = new HashMap<>();
        if (!rs.isEmpty()) {
            for (SaleRefundLine rl : refundLines.findByRefundIdIn(rs.stream().map(SaleRefund::getId).toList())) {
                rls.computeIfAbsent(rl.getRefundId(), k -> new ArrayList<>())
                        .add(new PosSaleResponse.RefundLine(rl.getVariantId().toString(), rl.getQty()));
            }
        }
        Map<UUID, List<PosSaleResponse.Refund>> rf = new HashMap<>();
        for (SaleRefund r : rs) {
            rf.computeIfAbsent(r.getSaleId(), k -> new ArrayList<>()).add(new PosSaleResponse.Refund(r.getAt(),
                    r.getAmount(), r.getMethod(), r.isRestock(), rls.getOrDefault(r.getId(), List.of()), r.getByName()));
        }
        return rows.stream().map(s -> new PosSaleResponse(s.getId().toString(), str(s.getClientRef()), s.getNumber(),
                str(s.getShiftId()), ls.getOrDefault(s.getId(), List.of()), s.getSubtotal(), s.getDiscount(),
                s.getDiscountReason(), s.getTotal(), ps.getOrDefault(s.getId(), List.of()), s.getCash(),
                s.getCustomerName(), s.getByName(), rf.getOrDefault(s.getId(), List.of()), s.getAt())).toList();
    }

    private void changed(Workspace w, String name, UUID id) {
        events.publishEvent(StreamEvent.toBusiness(w.businessId(), name, Map.of("id", id.toString())));
    }

    private static <T> Map<UUID, T> byId(List<T> rows, Function<T, UUID> id) {
        return rows.stream().collect(Collectors.toMap(id, Function.identity()));
    }

    private static String str(UUID id) {
        return id == null ? null : id.toString();
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static Optional<UUID> parseUuid(String s) {
        try {
            return Optional.of(UUID.fromString(s));
        } catch (IllegalArgumentException ex) {
            return Optional.empty();
        }
    }
}
