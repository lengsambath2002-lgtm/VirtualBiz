package com.kosign.vbiz.catalog.service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.activity.service.ShopActivityLog;
import com.kosign.vbiz.business.domain.BusinessType;
import com.kosign.vbiz.business.service.WorkspaceAccess;
import com.kosign.vbiz.business.service.WorkspaceAccess.Workspace;
import com.kosign.vbiz.catalog.domain.Product;
import com.kosign.vbiz.catalog.domain.ProductStatus;
import com.kosign.vbiz.catalog.domain.ProductVariant;
import com.kosign.vbiz.catalog.payload.ProductInput;
import com.kosign.vbiz.catalog.payload.VariantInput;
import com.kosign.vbiz.catalog.repository.ProductRepository;
import com.kosign.vbiz.catalog.repository.ProductVariantRepository;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.imports.ImportReport;
import com.kosign.vbiz.common.imports.RowCheck;
import com.kosign.vbiz.inventory.domain.StockReason;
import com.kosign.vbiz.inventory.service.StockWrite;
import com.kosign.vbiz.inventory.service.StockWriter;

import lombok.RequiredArgsConstructor;

/**
 * Product CSV import (docs/api/phase16-shop-lists.md). The columns are the product export's, so an
 * exported file comes back in: a row whose SKU the shop already has updates that variant's price,
 * compare-at, cost, barcode and stock (counted stock, written as a count correction through the
 * stock writer); a row with a new or no SKU and no variant name creates a one-variant product.
 * The whole file is checked first; nothing is written while it has problems unless
 * {@code skipInvalid}.
 */
@Service
@RequiredArgsConstructor
public class ProductImportService {

    private final ShopActivityLog activity;
    private final WorkspaceAccess access;
    private final ProductRepository products;
    private final ProductVariantRepository variants;
    private final ProductService productService;
    private final StockWriter stock;

    private sealed interface Plan permits Update, Create, Same {
    }

    private record Update(ProductVariant v, BigDecimal price, BigDecimal compareAt, BigDecimal cost, String barcode,
            Integer stock) implements Plan {
    }

    private record Create(ProductInput input) implements Plan {
    }

    private record Same() implements Plan {
    }

    @Transactional
    public ImportReport run(List<Map<String, String>> rows, boolean dryRun, boolean skipInvalid) {
        Workspace w = access.manager();
        WorkspaceAccess.requireType(w, BusinessType.PRODUCT);
        Map<String, ProductVariant> bySku = new HashMap<>();
        List<Product> ps = products.findByBusinessIdAndDeletedAtIsNullOrderByCreatedAtDescIdAsc(w.businessId());
        for (ProductVariant v : variants.findLiveByProductIds(ps.stream().map(Product::getId).toList())) {
            if (v.getSku() != null && !v.getSku().isBlank()) {
                bySku.put(v.getSku().toLowerCase(Locale.ROOT), v);
            }
        }

        List<ImportReport.RowError> errors = new ArrayList<>();
        List<Plan> plans = new ArrayList<>();
        Set<String> seenSku = new HashSet<>();
        Set<String> seenBarcode = new HashSet<>();
        int created = 0;
        int updated = 0;
        int same = 0;
        for (int i = 0; i < rows.size(); i++) {
            RowCheck c = new RowCheck(rows.get(i), i);
            Plan plan = plan(w, c, bySku, seenSku, seenBarcode);
            if (c.ok()) {
                plans.add(plan);
                if (plan instanceof Create) {
                    created++;
                } else if (plan instanceof Update) {
                    updated++;
                } else {
                    same++;
                }
            } else {
                errors.addAll(c.errors());
                plans.add(null);
            }
        }
        int bad = (int) plans.stream().filter(Objects::isNull).count();
        boolean apply = !dryRun && (errors.isEmpty() || skipInvalid);
        if (apply) {
            for (Plan p : plans) {
                if (p instanceof Update u) {
                    apply(w, u);
                } else if (p instanceof Create cr) {
                    productService.create(cr.input());
                }
            }
        }
        if (apply) {
            activity.record(w, ShopActivityLog.DATA_IMPORTED, "DATA", "products", "products",
                    Map.of("rows", rows.size(), "created", created, "updated", updated, "skipped", same + bad));
        }
        return new ImportReport(rows.size(), created, updated, same + bad, errors, apply);
    }

    private Plan plan(Workspace w, RowCheck c, Map<String, ProductVariant> bySku, Set<String> seenSku,
            Set<String> seenBarcode) {
        String sku = c.optional("SKU", 40);
        String title = c.optional("Product", 80);
        String variant = c.text("Variant");
        BigDecimal compareAt = c.money("Compare at (USD)", false);
        BigDecimal cost = c.money("Cost (USD)", false);
        Integer count = c.integer("Stock", 0, ProductRules.MAX_STOCK, false);
        String barcode = c.optional("Barcode", 32);
        String collection = c.optional("Collection", 40);
        String statusRaw = c.text("Status");
        ProductStatus status = ProductStatus.ACTIVE;
        if (statusRaw != null) {
            switch (statusRaw.toLowerCase(Locale.ROOT)) {
                case "active" -> status = ProductStatus.ACTIVE;
                case "draft" -> status = ProductStatus.DRAFT;
                default -> c.error("Status", "Active or Draft");
            }
        }
        if (sku != null && !seenSku.add(sku.toLowerCase(Locale.ROOT))) {
            c.error("SKU", "This SKU is on an earlier row too");
        }
        if (barcode != null && !seenBarcode.add(barcode)) {
            c.error("Barcode", "This barcode is on an earlier row too");
        }
        ProductVariant v = sku == null ? null : bySku.get(sku.toLowerCase(Locale.ROOT));
        BigDecimal price = c.money("Price (USD)", v == null);
        BigDecimal effPrice = price != null ? price : v != null ? v.getPrice() : null;
        if (compareAt != null && effPrice != null && compareAt.compareTo(effPrice) <= 0) {
            c.error("Compare at (USD)", "Must be more than the price");
        }
        if (price != null && price.signum() == 0) {
            c.error("Price (USD)", "Must be more than 0");
        }

        if (v != null) {
            if (barcode != null && !barcode.equals(v.getBarcode())
                    && variants.barcodeTaken(w.businessId(), barcode, v.getProductId())) {
                c.error("Barcode", "Another product already has this barcode");
            }
            boolean changes = (price != null && price.compareTo(v.getPrice()) != 0)
                    || (compareAt != null && (v.getCompareAt() == null || compareAt.compareTo(v.getCompareAt()) != 0))
                    || (cost != null && (v.getCost() == null || cost.compareTo(v.getCost()) != 0))
                    || (barcode != null && !barcode.equals(v.getBarcode()))
                    || (count != null && count != v.getStock());
            return changes ? new Update(v, price, compareAt, cost, barcode, count) : new Same();
        }

        if (variant != null) {
            c.error("Variant", "No variant has this SKU. Add variants in the product editor.");
            return null;
        }
        if (title == null) {
            c.error("Product", "Required for a new product");
            return null;
        }
        if (barcode != null && variants.barcodeUsed(w.businessId(), barcode)) {
            c.error("Barcode", "Another product already has this barcode");
        }
        ProductInput input = new ProductInput(title, null, collection, status, null, List.of(),
                List.of(new VariantInput("new", Map.of(), price, compareAt, cost, sku, barcode, null,
                        count == null ? 0 : count)),
                List.of(), Map.of());
        try {
            ProductRules.validate(input);
        } catch (BusinessException e) {
            c.error(e.getField(), e.getMessage());
        }
        return new Create(input);
    }

    private void apply(Workspace w, Update u) {
        ProductVariant v = u.v();
        if (u.price() != null) {
            v.setPrice(u.price());
        }
        if (u.compareAt() != null) {
            v.setCompareAt(u.compareAt());
        }
        if (u.cost() != null) {
            v.setCost(u.cost());
        }
        if (u.barcode() != null) {
            v.setBarcode(u.barcode());
        }
        variants.saveAndFlush(v);
        if (u.stock() != null && u.stock() != v.getStock()) {
            stock.write(new StockWrite(w.businessId(), v.getId(), u.stock() - v.getStock(),
                    StockReason.COUNT_CORRECTION, w.userId(), w.actorName(), "CSV import", false));
        }
    }
}
