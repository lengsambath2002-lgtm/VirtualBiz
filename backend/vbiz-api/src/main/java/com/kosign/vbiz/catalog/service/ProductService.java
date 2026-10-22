package com.kosign.vbiz.catalog.service;

import java.time.Clock;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.activity.service.ShopActivityLog;
import com.kosign.vbiz.business.service.WorkspaceAccess;
import com.kosign.vbiz.business.service.WorkspaceAccess.Workspace;
import com.kosign.vbiz.catalog.domain.Collection;
import com.kosign.vbiz.catalog.domain.Product;
import com.kosign.vbiz.catalog.domain.ProductStatus;
import com.kosign.vbiz.catalog.domain.ProductVariant;
import com.kosign.vbiz.catalog.mapper.CatalogMapper;
import com.kosign.vbiz.catalog.payload.CollectionResponse;
import com.kosign.vbiz.catalog.payload.ProductInput;
import com.kosign.vbiz.catalog.payload.SellerProductResponse;
import com.kosign.vbiz.catalog.repository.CollectionRepository;
import com.kosign.vbiz.catalog.repository.ProductRepository;
import com.kosign.vbiz.catalog.repository.ProductVariantRepository;
import com.kosign.vbiz.catalog.service.ProductRules.CleanProduct;
import com.kosign.vbiz.catalog.service.ProductRules.CleanVariant;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.inventory.domain.StockReason;
import com.kosign.vbiz.inventory.service.StockWrite;
import com.kosign.vbiz.inventory.service.StockWriter;

import lombok.RequiredArgsConstructor;

/**
 * The seller's products (Seller prototype: products page and editor). Opening stock is written
 * through the inventory {@link StockWriter}; this service never touches stock itself.
 */
@Service
@RequiredArgsConstructor
public class ProductService {

    private final ShopActivityLog activity;
    private final WorkspaceAccess access;
    private final ProductRepository products;
    private final ProductVariantRepository variants;
    private final CollectionRepository collections;
    private final CollectionService collectionService;
    private final ListingSlugs slugs;
    private final BarcodeService barcodes;
    private final StockWriter stock;
    private final Clock clock;

    @Transactional(readOnly = true)
    public List<SellerProductResponse> list() {
        Workspace w = access.member();
        List<Product> ps = products.findByBusinessIdAndDeletedAtIsNullOrderByCreatedAtDescIdAsc(w.businessId());
        return toResponses(w.businessId(), ps);
    }

    @Transactional(readOnly = true)
    public SellerProductResponse get(UUID id) {
        Workspace w = access.member();
        return toResponses(w.businessId(), List.of(require(w, id))).get(0);
    }

    @Transactional
    public SellerProductResponse create(ProductInput input) {
        Workspace w = access.manager();
        CleanProduct in = ProductRules.validate(input);
        UUID none = UUID.randomUUID();
        checkUnique(w.businessId(), in.variants(), none);
        Product p = new Product();
        p.setBusinessId(w.businessId());
        p.setSlug(slugs.unique(in.title()));
        p.setCategoryId(w.business().getCategoryId());
        p.setPosition(products.maxPosition(w.businessId()) + 1);
        apply(w, p, in);
        products.saveAndFlush(p);
        Set<String> reserved = in.variants().stream().map(CleanVariant::barcode).filter(b -> !b.isEmpty())
                .collect(Collectors.toCollection(HashSet::new));
        List<ProductVariant> created = new ArrayList<>();
        for (int i = 0; i < in.variants().size(); i++) {
            created.add(newVariant(w, p, in.variants().get(i), i, reserved));
        }
        variants.saveAllAndFlush(created);
        for (int i = 0; i < created.size(); i++) {
            open(w, created.get(i), in.variants().get(i).stock(), null);
        }
        activity.record(w, ShopActivityLog.PRODUCT_CREATED, "PRODUCT", p.getId(), p.getTitle(),
                Map.of("variants", created.size(), "status", p.getStatus().name()));
        return get(w, p);
    }

    /** Replace the product; variants are matched by id (kept ones keep their stock). */
    @Transactional
    public SellerProductResponse update(UUID id, ProductInput input) {
        Workspace w = access.manager();
        Product p = require(w, id);
        CleanProduct in = ProductRules.validate(input);
        checkUnique(w.businessId(), in.variants(), p.getId());
        apply(w, p, in);
        products.save(p);

        Map<String, ProductVariant> current = variants.findLiveByProductIds(List.of(p.getId())).stream()
                .collect(Collectors.toMap(v -> v.getId().toString(), Function.identity()));
        Set<String> keep = in.variants().stream().map(CleanVariant::id).filter(current::containsKey)
                .collect(Collectors.toSet());
        // Removed variants go first so their barcodes / SKUs are free for the new rows.
        current.forEach((vid, v) -> {
            if (!keep.contains(vid)) {
                v.setDeletedAt(clock.instant());
            }
        });
        variants.flush();
        Set<String> reserved = in.variants().stream().map(CleanVariant::barcode).filter(b -> !b.isEmpty())
                .collect(Collectors.toCollection(HashSet::new));
        Map<ProductVariant, Integer> opening = new LinkedHashMap<>();
        for (int i = 0; i < in.variants().size(); i++) {
            CleanVariant cv = in.variants().get(i);
            ProductVariant v = current.get(cv.id());
            if (v != null && keep.contains(cv.id())) {
                fill(v, cv, i);
                if (cv.barcode().isEmpty()) {
                    v.setBarcode(v.getBarcode() == null || v.getBarcode().isEmpty()
                            ? barcodes.next(w.businessId(), reserved) : v.getBarcode());
                }
                variants.save(v);
            } else {
                opening.put(variants.save(newVariant(w, p, cv, i, reserved)), cv.stock());
            }
        }
        variants.flush();
        opening.forEach((v, qty) -> open(w, v, qty, "newVariant"));
        activity.record(w, ShopActivityLog.PRODUCT_UPDATED, "PRODUCT", p.getId(), p.getTitle(), Map.of());
        return get(w, p);
    }

    @Transactional
    public SellerProductResponse setStatus(UUID id, ProductStatus status) {
        Workspace w = access.manager();
        Product p = require(w, id);
        ProductStatus before = p.getStatus();
        p.setStatus(status);
        products.saveAndFlush(p);
        if (before != status) {
            activity.record(w, ShopActivityLog.PRODUCT_STATUS, "PRODUCT", p.getId(), p.getTitle(),
                    Map.of("from", before.name(), "to", status.name()));
        }
        return get(w, p);
    }

    /** "{title} (copy)", DRAFT, stock 0, empty SKUs, new barcodes (prototype "Duplicate"). */
    @Transactional
    public SellerProductResponse duplicate(UUID id) {
        Workspace w = access.manager();
        Product src = require(w, id);
        String title = src.getTitle() + " (copy)";
        if (title.length() > 80) {
            title = src.getTitle().substring(0, 73) + " (copy)";
        }
        Product p = new Product();
        p.setBusinessId(w.businessId());
        p.setSlug(slugs.unique(title));
        p.setTitle(title);
        p.setDescription(src.getDescription());
        p.setCategoryId(src.getCategoryId());
        p.setCollectionId(src.getCollectionId());
        p.setStatus(ProductStatus.DRAFT);
        p.setOptions(new ArrayList<>(src.getOptions()));
        p.setPhotos(new ArrayList<>(src.getPhotos()));
        p.setSpecs(new ArrayList<>(src.getSpecs()));
        p.setLowStockAt(src.getLowStockAt());
        p.setPosition(products.maxPosition(w.businessId()) + 1);
        products.saveAndFlush(p);
        Set<String> reserved = new HashSet<>();
        List<ProductVariant> copies = new ArrayList<>();
        for (ProductVariant v : variants.findLiveByProductIds(List.of(src.getId()))) {
            ProductVariant c = new ProductVariant();
            c.setProductId(p.getId());
            c.setBusinessId(w.businessId());
            c.setOptionValues(new ArrayList<>(v.getOptionValues()));
            c.setPrice(v.getPrice());
            c.setCompareAt(v.getCompareAt());
            c.setCost(v.getCost());
            c.setSku("");
            c.setSwatch(v.getSwatch());
            c.setPosition(v.getPosition());
            String code = barcodes.next(w.businessId(), reserved);
            reserved.add(code);
            c.setBarcode(code);
            copies.add(c);
        }
        variants.saveAllAndFlush(copies);
        return get(w, p);
    }

    /** Soft delete: the product and its variants leave every list; the movement log keeps its rows. */
    @Transactional
    public void delete(UUID id) {
        Workspace w = access.manager();
        Product p = require(w, id);
        p.setDeletedAt(clock.instant());
        variants.findLiveByProductIds(List.of(p.getId())).forEach(v -> v.setDeletedAt(clock.instant()));
        products.saveAndFlush(p);
        activity.record(w, ShopActivityLog.PRODUCT_DELETED, "PRODUCT", p.getId(), p.getTitle(), Map.of());
    }

    // ── helpers ──────────────────────────────────────────────────────────────────────

    private Product require(Workspace w, UUID id) {
        return products.findByIdAndBusinessIdAndDeletedAtIsNull(id, w.businessId())
                .orElseThrow(() -> new BusinessException(StatusCode.PRODUCT_NOT_FOUND));
    }

    private void apply(Workspace w, Product p, CleanProduct in) {
        p.setTitle(in.title());
        p.setDescription(in.description());
        p.setStatus(in.status());
        p.setLowStockAt(in.lowStockAt());
        p.setOptions(new ArrayList<>(in.options()));
        p.setPhotos(new ArrayList<>(in.photos()));
        p.setSpecs(new ArrayList<>(in.specs()));
        p.setCollectionId(in.collection() == null ? null : collectionService.idForName(w, in.collection()));
    }

    private void checkUnique(UUID businessId, List<CleanVariant> vs, UUID productId) {
        for (int i = 0; i < vs.size(); i++) {
            CleanVariant v = vs.get(i);
            if (!v.sku().isEmpty() && variants.skuTaken(businessId, v.sku(), productId)) {
                throw BusinessException.withDetail(StatusCode.DUPLICATE_SKU, "variants[" + i + "].sku",
                        "SKU already used in this shop");
            }
            if (!v.barcode().isEmpty() && variants.barcodeTaken(businessId, v.barcode(), productId)) {
                throw BusinessException.withDetail(StatusCode.DUPLICATE_BARCODE, "variants[" + i + "].barcode",
                        "Barcode already used in this shop");
            }
        }
    }

    private ProductVariant newVariant(Workspace w, Product p, CleanVariant cv, int position, Set<String> reserved) {
        ProductVariant v = new ProductVariant();
        v.setProductId(p.getId());
        v.setBusinessId(w.businessId());
        fill(v, cv, position);
        if (cv.barcode().isEmpty()) {
            String code = barcodes.next(w.businessId(), reserved);
            reserved.add(code);
            v.setBarcode(code);
        }
        return v;
    }

    private static void fill(ProductVariant v, CleanVariant cv, int position) {
        v.setOptionValues(new ArrayList<>(cv.values()));
        v.setPrice(cv.price());
        v.setCompareAt(cv.compareAt());
        v.setCost(cv.cost());
        v.setSku(cv.sku());
        if (!cv.barcode().isEmpty()) {
            v.setBarcode(cv.barcode());
        }
        v.setSwatch(cv.swatch());
        v.setPosition(position);
    }

    private void open(Workspace w, ProductVariant v, int qty, String note) {
        if (qty > 0) {
            stock.write(new StockWrite(w.businessId(), v.getId(), qty, StockReason.OPENING_STOCK, w.userId(),
                    w.actorName(), note, false));
        }
    }

    private SellerProductResponse get(Workspace w, Product p) {
        return toResponses(w.businessId(), List.of(p)).get(0);
    }

    private List<SellerProductResponse> toResponses(UUID businessId, List<Product> ps) {
        if (ps.isEmpty()) {
            return List.of();
        }
        Map<UUID, List<ProductVariant>> byProduct = variants
                .findLiveByProductIds(ps.stream().map(Product::getId).toList()).stream()
                .collect(Collectors.groupingBy(ProductVariant::getProductId));
        Map<UUID, String> names = collections.findByBusinessIdOrderByPositionAscNameAsc(businessId).stream()
                .collect(Collectors.toMap(Collection::getId, Collection::getName));
        return ps.stream().map(p -> CatalogMapper.toSeller(p, byProduct.getOrDefault(p.getId(), List.of()),
                p.getCollectionId() == null ? null : names.get(p.getCollectionId()))).toList();
    }
}
