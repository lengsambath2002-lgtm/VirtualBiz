package com.kosign.vbiz.inventory.service;

import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.business.service.WorkspaceAccess;
import com.kosign.vbiz.business.service.WorkspaceAccess.Workspace;
import com.kosign.vbiz.catalog.domain.Product;
import com.kosign.vbiz.catalog.domain.ProductStatus;
import com.kosign.vbiz.catalog.domain.ProductVariant;
import com.kosign.vbiz.catalog.mapper.CatalogMapper;
import com.kosign.vbiz.catalog.repository.ProductRepository;
import com.kosign.vbiz.catalog.repository.ProductVariantRepository;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.inventory.domain.StockMovement;
import com.kosign.vbiz.inventory.domain.StockReason;
import com.kosign.vbiz.inventory.mapper.InventoryMapper;
import com.kosign.vbiz.inventory.payload.RevertResponse;
import com.kosign.vbiz.inventory.payload.StockAlertResponse;
import com.kosign.vbiz.inventory.payload.StockMovementResponse;
import com.kosign.vbiz.inventory.payload.StockWriteRequest;
import com.kosign.vbiz.inventory.payload.StockWriteResponse;
import com.kosign.vbiz.inventory.repository.StockMovementRepository;

import lombok.RequiredArgsConstructor;

/** Inventory page: the movement log, manual adjustments (through {@link StockWriter}), undo, alerts. */
@Service
@RequiredArgsConstructor
public class InventoryService {

    /**
     * Reasons the workspace may send. OPENING_STOCK (product editor), ORDER_SALE and
     * ORDER_CANCELLED (orders, Phase 3), POS_SALE and POS_REFUND (the register, Phase 5) are
     * server-only.
     */
    static final Set<StockReason> CLIENT_REASONS = EnumSet.of(StockReason.RECEIVED, StockReason.COUNT_CORRECTION,
            StockReason.DAMAGED_LOST, StockReason.CUSTOMER_RETURN, StockReason.QUICK_ADJUST,
            StockReason.MARKED_SOLD_OUT);

    private static final int DEFAULT_LIMIT = 100;
    private static final int MAX_LIMIT = 500;

    private final WorkspaceAccess access;
    private final StockWriter writer;
    private final StockMovementRepository movements;
    private final ProductVariantRepository variants;
    private final ProductRepository products;

    @Transactional(readOnly = true)
    public List<StockMovementResponse> movements(UUID variantId, UUID productId, Integer limit) {
        Workspace w = access.member();
        int n = limit == null ? DEFAULT_LIMIT : Math.max(1, Math.min(MAX_LIMIT, limit));
        PageRequest page = PageRequest.of(0, n);
        List<StockMovement> rows = variantId != null
                ? movements.latestOfVariant(w.businessId(), variantId, page)
                : productId != null
                        ? movements.latestOfProduct(w.businessId(), productId, page)
                        : movements.latest(w.businessId(), page);
        Map<UUID, UUID> productOf = productIds(rows.stream().map(StockMovement::getVariantId).toList());
        return rows.stream().map(m -> InventoryMapper.toResponse(m, productOf.get(m.getVariantId()))).toList();
    }

    @Transactional
    public StockWriteResponse write(StockWriteRequest req) {
        Workspace w = access.member();
        if (!CLIENT_REASONS.contains(req.reason())) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "reason",
                    req.reason() + " is written by the server only");
        }
        if (Boolean.TRUE.equals(req.system())) {
            // Automatic rows are written by the server only (order restocks since Phase 3).
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "system",
                    "Automatic movements are written by the server only");
        }
        StockWriter.Outcome out = writer.write(new StockWrite(w.businessId(), req.variantId(), req.delta(),
                req.reason(), w.userId(), w.actorName(), req.note(), Boolean.TRUE.equals(req.mergeQuick())));
        return new StockWriteResponse(InventoryMapper.toResponse(out.movement(), out.variant().getProductId()),
                InventoryMapper.toStock(out.variant()), out.merged());
    }

    @Transactional
    public RevertResponse revert(UUID movementId) {
        Workspace w = access.member();
        return new RevertResponse(InventoryMapper.toStock(writer.revert(w.businessId(), movementId)));
    }

    /** Variants of ACTIVE products at or below the alert level; {@code state} LOW or OUT narrows it. */
    @Transactional(readOnly = true)
    public List<StockAlertResponse> alerts(String state) {
        Workspace w = access.member();
        String only = state == null || state.isBlank() ? null : state.trim().toUpperCase();
        if (only != null && !only.equals("LOW") && !only.equals("OUT")) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "state", "Use LOW or OUT");
        }
        Map<UUID, Product> ps = products.findListed(List.of(w.businessId()), ProductStatus.ACTIVE).stream()
                .collect(Collectors.toMap(Product::getId, Function.identity()));
        if (ps.isEmpty()) {
            return List.of();
        }
        return variants.findLiveByProductIds(ps.keySet()).stream()
                .filter(v -> v.getStock() <= ps.get(v.getProductId()).getLowStockAt())
                .map(v -> {
                    Product p = ps.get(v.getProductId());
                    String st = v.getStock() == 0 ? "OUT" : "LOW";
                    return new StockAlertResponse(p.getId().toString(), p.getTitle(), v.getId().toString(),
                            CatalogMapper.variantName(v.getOptionValues()), v.getSku(), v.getStock(),
                            p.getLowStockAt(), st);
                })
                .filter(a -> only == null || a.state().equals(only))
                .toList();
    }

    private Map<UUID, UUID> productIds(Collection<UUID> variantIds) {
        return variants.findAllById(Set.copyOf(variantIds)).stream()
                .collect(Collectors.toMap(ProductVariant::getId, ProductVariant::getProductId));
    }
}
