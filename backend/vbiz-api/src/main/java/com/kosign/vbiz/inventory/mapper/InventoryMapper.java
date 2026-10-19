package com.kosign.vbiz.inventory.mapper;

import java.util.UUID;

import com.kosign.vbiz.catalog.domain.ProductVariant;
import com.kosign.vbiz.inventory.domain.StockMovement;
import com.kosign.vbiz.inventory.payload.StockMovementResponse;
import com.kosign.vbiz.inventory.payload.VariantStockResponse;

public final class InventoryMapper {

    private InventoryMapper() {
    }

    public static StockMovementResponse toResponse(StockMovement m, UUID productId) {
        return new StockMovementResponse(m.getId().toString(), m.getVariantId().toString(),
                productId == null ? null : productId.toString(), m.getDelta(), m.getReason(),
                m.getByUserId() == null ? null : m.getByUserId().toString(), m.getByName(), m.getNote(), m.getAt());
    }

    public static VariantStockResponse toStock(ProductVariant v) {
        return new VariantStockResponse(v.getId().toString(), v.getProductId().toString(), v.getStock());
    }
}
