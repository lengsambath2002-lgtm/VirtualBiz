package com.kosign.vbiz.report.service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.booking.domain.Appointment;
import com.kosign.vbiz.booking.repository.AppointmentRepository;
import com.kosign.vbiz.business.domain.BusinessMember;
import com.kosign.vbiz.business.domain.BusinessType;
import com.kosign.vbiz.business.repository.BusinessMemberRepository;
import com.kosign.vbiz.business.service.WorkspaceAccess;
import com.kosign.vbiz.business.service.WorkspaceAccess.Workspace;
import com.kosign.vbiz.catalog.domain.Product;
import com.kosign.vbiz.catalog.domain.ProductVariant;
import com.kosign.vbiz.catalog.domain.ServiceItem;
import com.kosign.vbiz.catalog.repository.CollectionRepository;
import com.kosign.vbiz.catalog.repository.ProductRepository;
import com.kosign.vbiz.catalog.repository.ProductVariantRepository;
import com.kosign.vbiz.catalog.repository.ServiceItemRepository;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.customer.domain.Client;
import com.kosign.vbiz.customer.repository.ClientRepository;
import com.kosign.vbiz.order.domain.Order;
import com.kosign.vbiz.order.domain.OrderLine;
import com.kosign.vbiz.order.repository.OrderLineRepository;
import com.kosign.vbiz.order.repository.OrderRepository;
import com.kosign.vbiz.pos.domain.Sale;
import com.kosign.vbiz.pos.domain.SaleLine;
import com.kosign.vbiz.pos.domain.SalePayment;
import com.kosign.vbiz.pos.domain.SaleRefund;
import com.kosign.vbiz.pos.repository.SaleLineRepository;
import com.kosign.vbiz.pos.repository.SalePaymentRepository;
import com.kosign.vbiz.pos.repository.SaleRefundRepository;
import com.kosign.vbiz.pos.repository.SaleRepository;
import com.kosign.vbiz.common.csv.CsvWriter;
import com.kosign.vbiz.report.domain.ExportKind;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * CSV exports of a shop's records (docs/api/phase14-customers-exports.md). Owners and managers
 * only: the files hold customers' names and phone numbers. Every export is logged with who took it.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExportService {

    /** The longest date range one file covers. */
    static final int MAX_DAYS = 366;
    private static final int DEFAULT_DAYS = 30;

    private final WorkspaceAccess access;
    private final OrderRepository orders;
    private final OrderLineRepository orderLines;
    private final SaleRepository sales;
    private final SaleLineRepository saleLines;
    private final SalePaymentRepository salePayments;
    private final SaleRefundRepository refunds;
    private final ProductRepository products;
    private final ProductVariantRepository variants;
    private final CollectionRepository collections;
    private final ClientRepository clients;
    private final AppointmentRepository appointments;
    private final ServiceItemRepository services;
    private final BusinessMemberRepository members;
    private final Clock clock;

    public record Export(String filename, byte[] csv, int rows) {
    }

    @Transactional(readOnly = true)
    public Export export(String kindName, LocalDate fromDay, LocalDate toDay) {
        ExportKind kind = ExportKind.of(kindName)
                .orElseThrow(() -> BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "kind",
                        "one of " + Arrays.stream(ExportKind.values()).map(ExportKind::path).toList()));
        Workspace w = access.manager();
        if (kind.type() != null) {
            WorkspaceAccess.requireType(w, kind.type());
        }
        LocalDate to = toDay != null ? toDay : LocalDate.now(clock.withZone(CsvWriter.PHNOM_PENH));
        LocalDate from = fromDay != null ? fromDay : to.minusDays(DEFAULT_DAYS - 1);
        if (from.isAfter(to)) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "from", "on or before to");
        }
        if (ChronoUnit.DAYS.between(from, to) >= MAX_DAYS) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "to", "at most " + MAX_DAYS + " days");
        }
        UUID b = w.businessId();
        CsvWriter csv = switch (kind) {
            case ORDERS -> orders(b, from, to);
            case SALES -> sales(b, from, to);
            case APPOINTMENTS -> appointments(b, from, to);
            case PRODUCTS -> products(b);
            case CUSTOMERS -> customers(b);
        };
        String range = kind.dated() ? "-" + from + "_" + to : "-" + to;
        String name = w.business().getSlug() + "-" + kind.path() + range + ".csv";
        log.info("EXPORT {} business={} by={} ({}) rows={}{}", kind, b, w.userId(), w.actorName(), csv.rows(),
                kind.dated() ? " range=" + from + ".." + to : "");
        return new Export(name, csv.bytes(), csv.rows());
    }

    private CsvWriter orders(UUID b, LocalDate from, LocalDate to) {
        List<Order> os = orders.placedBetween(b, start(from), start(to.plusDays(1)));
        Map<UUID, List<OrderLine>> lines = orderLines.findByOrderIdInOrderByPositionAsc(ids(os, Order::getId))
                .stream().collect(Collectors.groupingBy(OrderLine::getOrderId));
        CsvWriter csv = new CsvWriter("Order", "Placed", "Status", "Customer", "Phone", "Fulfilment", "Address",
                "District", "Items", "Quantity", "Subtotal (USD)", "Discount (USD)", "Promo code",
                "Promo discount (USD)", "Delivery fee (USD)", "Total (USD)", "Cancel reason");
        for (Order o : os) {
            List<OrderLine> ls = lines.getOrDefault(o.getId(), List.of());
            csv.row(o.getNumber(), o.getPlacedAt(), o.getStatus(), o.getContactName(), o.getContactPhone(),
                    o.getMethod(), o.getAddress() == null ? null : o.getAddress().line(),
                    o.getAddress() == null ? null : o.getAddress().district(),
                    ls.stream().map(l -> l.getQty() + " × " + l.getTitle()).collect(Collectors.joining("; ")),
                    ls.stream().mapToInt(OrderLine::getQty).sum(), o.getSubtotal(), o.getDiscount(), o.getPromoCode(),
                    o.getPromoDiscount(), o.getDeliveryFee(), o.getTotal(), o.getCancelReason());
        }
        return csv;
    }

    private CsvWriter sales(UUID b, LocalDate from, LocalDate to) {
        List<Sale> ss = sales.ofBusiness(b, start(from), start(to.plusDays(1)));
        List<UUID> saleIds = ids(ss, Sale::getId);
        Map<UUID, List<SaleLine>> lines = saleLines.findBySaleIdInOrderByPositionAsc(saleIds).stream()
                .collect(Collectors.groupingBy(SaleLine::getSaleId));
        Map<UUID, List<SalePayment>> pays = salePayments.findBySaleIdInOrderByPositionAsc(saleIds).stream()
                .collect(Collectors.groupingBy(SalePayment::getSaleId));
        Map<UUID, BigDecimal> refunded = refunds.findBySaleIdInOrderByAtAsc(saleIds).stream()
                .collect(Collectors.groupingBy(SaleRefund::getSaleId,
                        Collectors.reducing(BigDecimal.ZERO, SaleRefund::getAmount, BigDecimal::add)));
        CsvWriter csv = new CsvWriter("Receipt", "Time", "Cashier", "Customer", "Items", "Subtotal (USD)",
                "Discount (USD)", "Discount reason", "Tip (USD)", "Total (USD)", "Paid by", "Refunded (USD)");
        for (Sale s : ss) {
            csv.row(s.getNumber(), s.getAt(), s.getByName(), s.getCustomerName(),
                    lines.getOrDefault(s.getId(), List.of()).stream()
                            .map(l -> l.getQty() + " × " + l.getTitle()
                                    + (l.getVariantName() == null || l.getVariantName().isBlank() ? ""
                                            : " (" + l.getVariantName() + ")"))
                            .collect(Collectors.joining("; ")),
                    s.getSubtotal(), s.getDiscount(), s.getDiscountReason(), s.getTip(), s.getTotal(),
                    pays.getOrDefault(s.getId(), List.of()).stream()
                            .map(p -> p.getMethod() + " " + CsvWriter.cell(p.getAmount()))
                            .collect(Collectors.joining("; ")),
                    refunded.getOrDefault(s.getId(), BigDecimal.ZERO));
        }
        return csv;
    }

    private CsvWriter appointments(UUID b, LocalDate from, LocalDate to) {
        List<Appointment> as = appointments.ofBusiness(b, from, to);
        Map<UUID, String> serviceNames = names(services.findAllById(ids(as, Appointment::getServiceId)),
                ServiceItem::getId, ServiceItem::getName);
        Map<UUID, String> staff = names(members.findAllById(ids(as, Appointment::getStaffId)), BusinessMember::getId,
                BusinessMember::getName);
        Map<UUID, Client> cs = clients.findByIdIn(ids(as, Appointment::getClientId)).stream()
                .collect(Collectors.toMap(Client::getId, Function.identity()));
        CsvWriter csv = new CsvWriter("Booking", "Date", "Start", "End", "Service", "Staff", "Client", "Phone",
                "Status", "Source", "Price (USD)", "Note", "Cancel reason");
        for (Appointment a : as) {
            Client c = cs.get(a.getClientId());
            csv.row(a.getNumber(), a.getDate(), CsvWriter.hm(a.getStart()),
                    CsvWriter.hm(a.getStart() + a.getDurationMin()), serviceNames.get(a.getServiceId()),
                    staff.get(a.getStaffId()), c == null ? null : c.getName(), c == null ? null : c.getPhone(),
                    a.getStatus(), a.getSource(), a.getPrice(), a.getNote(), a.getCancelReason());
        }
        return csv;
    }

    private CsvWriter products(UUID b) {
        List<Product> ps = products.findByBusinessIdAndDeletedAtIsNullOrderByCreatedAtDescIdAsc(b);
        Map<UUID, List<ProductVariant>> vs = variants.findLiveByProductIds(ids(ps, Product::getId)).stream()
                .collect(Collectors.groupingBy(ProductVariant::getProductId, LinkedHashMap::new, Collectors.toList()));
        Map<UUID, String> cols = new HashMap<>();
        collections.findByBusinessIdOrderByPositionAscNameAsc(b).forEach(c -> cols.put(c.getId(), c.getName()));
        CsvWriter csv = new CsvWriter("Product", "Variant", "SKU", "Barcode", "Collection", "Category",
                "Price (USD)", "Compare at (USD)", "Cost (USD)", "Stock", "Sold");
        for (Product p : ps) {
            for (ProductVariant v : vs.getOrDefault(p.getId(), List.of())) {
                csv.row(p.getTitle(), String.join(" / ", v.getOptionValues()), v.getSku(), v.getBarcode(),
                        cols.get(p.getCollectionId()), p.getCategoryId(), v.getPrice(), v.getCompareAt(), v.getCost(),
                        v.getStock(), p.getSoldCount());
            }
        }
        return csv;
    }

    private CsvWriter customers(UUID b) {
        CsvWriter csv = new CsvWriter("Name", "Phone", "Email", "District", "Note", "Customer since",
                "Has an account");
        for (Client c : clients.findByBusinessIdOrderByNameAscIdAsc(b)) {
            csv.row(c.getName(), c.getPhone(), c.getEmail(), c.getDistrict(), c.getNote(), c.getSince(),
                    c.getUserId() != null);
        }
        return csv;
    }

    private static java.time.Instant start(LocalDate d) {
        return d.atStartOfDay(CsvWriter.PHNOM_PENH).toInstant();
    }

    private static <T> List<UUID> ids(Collection<T> xs, Function<T, UUID> id) {
        List<UUID> out = new ArrayList<>();
        for (T x : xs) {
            UUID v = id.apply(x);
            if (v != null && !out.contains(v)) {
                out.add(v);
            }
        }
        return out;
    }

    private static <T> Map<UUID, String> names(Iterable<T> xs, Function<T, UUID> id, Function<T, String> name) {
        Map<UUID, String> out = new HashMap<>();
        xs.forEach(x -> out.put(id.apply(x), name.apply(x)));
        return out;
    }
}
