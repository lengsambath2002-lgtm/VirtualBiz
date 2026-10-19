package com.kosign.vbiz.catalog.mapper;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.kosign.vbiz.catalog.domain.ProductOption;
import com.kosign.vbiz.catalog.domain.Product;
import com.kosign.vbiz.catalog.domain.ProductVariant;
import com.kosign.vbiz.catalog.domain.ServiceItem;
import com.kosign.vbiz.catalog.domain.SpecRow;
import com.kosign.vbiz.catalog.payload.ProviderServiceResponse;
import com.kosign.vbiz.catalog.payload.SellerProductResponse;
import com.kosign.vbiz.catalog.payload.SellerVariantResponse;

/** Entity → payload for the catalog domain. */
public final class CatalogMapper {

    private CatalogMapper() {
    }

    /** {@code optionValues} (product option order) → {@code {name: value}} in that order. */
    public static Map<String, String> optionMap(List<ProductOption> options, List<String> values) {
        Map<String, String> m = new LinkedHashMap<>();
        for (int i = 0; i < options.size(); i++) {
            m.put(options.get(i).name(), i < values.size() ? values.get(i) : "");
        }
        return m;
    }

    public static Map<String, String> specMap(List<SpecRow> rows) {
        Map<String, String> m = new LinkedHashMap<>();
        if (rows != null) {
            rows.forEach(r -> m.put(r.label(), r.value()));
        }
        return m;
    }

    /** "Black / 128 GB" ('' when the product has no options). */
    public static String variantName(List<String> values) {
        return String.join(" / ", values);
    }

    public static SellerProductResponse toSeller(Product p, List<ProductVariant> variants, String collection) {
        return new SellerProductResponse(
                p.getId().toString(), p.getSlug(), p.getBusinessId().toString(), p.getTitle(), p.getDescription(),
                p.getCategoryId(), collection, p.getStatus(), p.getOptions(),
                variants.stream().map(v -> toSeller(p, v)).toList(),
                p.getPhotos(), specMap(p.getSpecs()), p.getLowStockAt(), p.getSoldCount(),
                p.getRating().doubleValue(), p.getCreatedAt(), p.getUpdatedAt());
    }

    public static SellerVariantResponse toSeller(Product p, ProductVariant v) {
        return new SellerVariantResponse(v.getId().toString(), p.getId().toString(),
                optionMap(p.getOptions(), v.getOptionValues()), v.getPrice(), v.getCompareAt(), v.getCost(),
                v.getSku(), v.getBarcode(), v.getStock(), v.getSwatch());
    }

    public static ProviderServiceResponse toProvider(ServiceItem s) {
        return new ProviderServiceResponse(s.getId().toString(), s.getSlug(), s.getBusinessId().toString(),
                s.getName(), s.getCategory(), s.getDescription(), s.getDurationMin(), s.getPrice(),
                s.getDiscountPct(), s.getStaffIds().stream().map(Object::toString).sorted().toList(),
                s.isBookableOnline(), s.getSoldCount(), s.getRating().doubleValue());
    }
}
