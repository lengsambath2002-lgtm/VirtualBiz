package com.kosign.vbiz.inventory.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.IntFunction;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.catalog.domain.ProductVariant;
import com.kosign.vbiz.catalog.repository.ProductVariantRepository;
import com.kosign.vbiz.common.api.ApiErrorDetail;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.inventory.domain.StockMovement;
import com.kosign.vbiz.inventory.domain.StockReason;
import com.kosign.vbiz.inventory.repository.StockMovementRepository;

import lombok.RequiredArgsConstructor;

/**
 * THE stock-movement writer (CLAUDE.md "Stock"). Every change to a variant's stock — opening
 * stock, adjustments, and later online orders and the POS — goes through here: the variant row
 * is locked, the delta applied (never below zero) and the movement appended in one transaction.
 * {@code ProductVariant.adjustStock} is called nowhere else (ArchitectureTest).
 */
@Service
@RequiredArgsConstructor
public class StockWriter {

    /** Quick ±1 taps within this window fold into one "Quick adjust" row (prototype). */
    static final Duration QUICK_MERGE_WINDOW = Duration.ofSeconds(60);

    private final ProductVariantRepository variants;
    private final StockMovementRepository movements;
    private final Clock clock;

    /** Result of a write: the logged (or merged) row and the variant with its new stock. */
    public record Outcome(StockMovement movement, ProductVariant variant, boolean merged) {
    }

    @Transactional
    public Outcome write(StockWrite w) {
        if (w.delta() == 0) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "delta", "Delta must not be zero");
        }
        ProductVariant v = lock(w.businessId(), w.variantId());
        if (v.getDeletedAt() != null) {
            throw BusinessException.withDetail(StatusCode.VARIANT_NOT_FOUND, "variantId", "Variant was removed");
        }
        requireNonNegative(v, w.delta());
        Instant now = clock.instant();
        if (w.mergeQuick() && w.reason() == StockReason.QUICK_ADJUST) {
            StockMovement last = movements.latest(w.businessId(), PageRequest.of(0, 1)).stream().findFirst()
                    .orElse(null);
            if (last != null && last.getVariantId().equals(v.getId())
                    && last.getReason() == StockReason.QUICK_ADJUST
                    && Objects.equals(last.getByUserId(), w.byUserId())
                    && Duration.between(last.getAt(), now).compareTo(QUICK_MERGE_WINDOW) < 0) {
                v.adjustStock(w.delta());
                last.setDelta(last.getDelta() + w.delta());
                return new Outcome(movements.saveAndFlush(last), variants.saveAndFlush(v), true);
            }
        }
        v.adjustStock(w.delta());
        StockMovement m = new StockMovement();
        m.setBusinessId(w.businessId());
        m.setVariantId(v.getId());
        m.setDelta(w.delta());
        m.setReason(w.reason());
        m.setByUserId(w.byUserId());
        m.setByName(w.byName());
        m.setNote(w.note() == null || w.note().isBlank() ? null : w.note().trim());
        m.setAt(now);
        return new Outcome(movements.saveAndFlush(m), variants.saveAndFlush(v), false);
    }

    /**
     * Several changes in one go (a checkout's lines, an order's restock): every variant is locked
     * in id order (two checkouts never deadlock), every resulting stock is checked before anything
     * is written, and one {@code INSUFFICIENT_STOCK} lists every short write ({@code field} from
     * {@code fieldOf(index)}, {@code meta: {variantId, stock, requested}}). Deltas of the same variant
     * are checked together. Returns the outcomes in input order.
     */
    @Transactional
    public List<Outcome> writeAll(List<StockWrite> writes, IntFunction<String> fieldOf) {
        Map<UUID, ProductVariant> locked = new HashMap<>();
        writes.stream().map(w -> Map.entry(w.variantId(), w.businessId())).distinct()
                .sorted(Map.Entry.comparingByKey(Comparator.naturalOrder()))
                .forEach(e -> locked.put(e.getKey(), lock(e.getValue(), e.getKey())));
        Map<UUID, Integer> net = new LinkedHashMap<>();
        List<ApiErrorDetail> problems = new ArrayList<>();
        for (int i = 0; i < writes.size(); i++) {
            StockWrite w = writes.get(i);
            if (w.delta() == 0) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, fieldOf.apply(i),
                        "Delta must not be zero");
            }
            ProductVariant v = locked.get(w.variantId());
            if (v.getDeletedAt() != null) {
                throw BusinessException.withDetail(StatusCode.VARIANT_NOT_FOUND, fieldOf.apply(i),
                        "Variant was removed", Map.of("variantId", v.getId().toString()));
            }
            int after = v.getStock() + net.getOrDefault(v.getId(), 0) + w.delta();
            if (after < 0) {
                problems.add(new ApiErrorDetail(fieldOf.apply(i), "Only " + v.getStock() + " in stock",
                        Map.of("variantId", v.getId().toString(), "stock", v.getStock(),
                                "requested", -w.delta())));
            }
            net.merge(v.getId(), w.delta(), Integer::sum);
        }
        if (!problems.isEmpty()) {
            throw BusinessException.withDetails(StatusCode.INSUFFICIENT_STOCK, problems);
        }
        List<Outcome> out = new ArrayList<>(writes.size());
        for (StockWrite w : writes) {
            out.add(write(w));
        }
        return out;
    }

    /** Undo one movement: reverse its delta and drop the row (prototype "Undo"). */
    @Transactional
    public ProductVariant revert(UUID businessId, UUID movementId) {
        StockMovement m = movements.findByIdAndBusinessId(movementId, businessId)
                .orElseThrow(() -> new BusinessException(StatusCode.MOVEMENT_NOT_FOUND));
        ProductVariant v = lock(businessId, m.getVariantId());
        requireNonNegative(v, -m.getDelta());
        v.adjustStock(-m.getDelta());
        movements.delete(m);
        return variants.saveAndFlush(v);
    }

    private ProductVariant lock(UUID businessId, UUID variantId) {
        return variants.lockForStock(variantId, businessId)
                .orElseThrow(() -> BusinessException.withDetail(
                        StatusCode.VARIANT_NOT_FOUND, "variantId", "Unknown variant"));
    }

    private static void requireNonNegative(ProductVariant v, int delta) {
        if (v.getStock() + delta < 0) {
            throw BusinessException.withDetail(StatusCode.INSUFFICIENT_STOCK, "delta",
                    "Only " + v.getStock() + " in stock", Map.of("stock", v.getStock()));
        }
    }
}
