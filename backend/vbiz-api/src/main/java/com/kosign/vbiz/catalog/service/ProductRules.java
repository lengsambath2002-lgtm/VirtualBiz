package com.kosign.vbiz.catalog.service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import com.kosign.vbiz.catalog.domain.ProductOption;
import com.kosign.vbiz.catalog.domain.ProductStatus;
import com.kosign.vbiz.catalog.domain.SpecRow;
import com.kosign.vbiz.catalog.payload.OptionInput;
import com.kosign.vbiz.catalog.payload.ProductInput;
import com.kosign.vbiz.catalog.payload.VariantInput;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.helper.Money;

/** Pure validation of the product editor's input (Seller prototype rules). */
public final class ProductRules {

    public static final int MAX_OPTIONS = 3;
    public static final int MAX_VARIANTS = 100;
    public static final int MAX_PHOTOS = 8;
    public static final int MAX_PHOTO_CHARS = 7_000_000;
    public static final int MAX_STOCK = 1_000_000;

    private ProductRules() {
    }

    /** A validated variant row; {@code values} follow the option order. */
    public record CleanVariant(String id, List<String> values, BigDecimal price, BigDecimal compareAt,
            BigDecimal cost, String sku, String barcode, String swatch, int stock) {
    }

    /** The validated product. */
    public record CleanProduct(String title, String description, String collection, ProductStatus status,
            int lowStockAt, List<ProductOption> options, List<CleanVariant> variants, List<String> photos,
            List<SpecRow> specs) {
    }

    public static CleanProduct validate(ProductInput in) {
        if (in == null) {
            throw fail("body", "Body is required");
        }
        String title = trim(in.title());
        if (title.length() < 2 || title.length() > 80) {
            throw fail("title", "Title must be 2–80 characters");
        }
        String description = trim(in.description());
        if (description.length() > 1000) {
            throw fail("description", "Description is too long");
        }
        String collection = trim(in.collection());
        if (collection.length() > 40) {
            throw fail("collection", "Collection name is too long");
        }
        if (in.status() == null) {
            throw fail("status", "Status is required");
        }
        int low = in.lowStockAt() == null ? 5 : in.lowStockAt();
        if (low < 0 || low > 100_000) {
            throw fail("lowStockAt", "Must be between 0 and 100000");
        }
        List<ProductOption> options = options(in.options());
        List<CleanVariant> variants = variants(options, in.variants());
        return new CleanProduct(title, description, collection.isEmpty() ? null : collection, in.status(), low,
                options, variants, photos(in.photos()), specs(in.specs()));
    }

    private static List<ProductOption> options(List<OptionInput> raw) {
        List<OptionInput> list = raw == null ? List.of() : raw;
        if (list.size() > MAX_OPTIONS) {
            throw fail("options", "At most 3 options");
        }
        Set<String> names = new HashSet<>();
        List<ProductOption> out = new ArrayList<>();
        for (int i = 0; i < list.size(); i++) {
            OptionInput o = list.get(i);
            String name = trim(o == null ? null : o.name());
            if (name.isEmpty() || name.length() > 30) {
                throw fail("options[" + i + "].name", "Option name is required (≤ 30)");
            }
            if (!names.add(name.toLowerCase(Locale.ROOT))) {
                throw fail("options[" + i + "].name", "Option names must be unique");
            }
            List<String> values = new ArrayList<>();
            Set<String> seen = new HashSet<>();
            for (String v : o.values() == null ? List.<String>of() : o.values()) {
                String val = trim(v);
                if (val.isEmpty() || val.length() > 40) {
                    throw fail("options[" + i + "].values", "Values must be 1–40 characters");
                }
                if (!seen.add(val.toLowerCase(Locale.ROOT))) {
                    throw fail("options[" + i + "].values", "Values must be unique");
                }
                values.add(val);
            }
            if (values.isEmpty()) {
                throw fail("options[" + i + "].values", "An option needs at least one value");
            }
            out.add(new ProductOption(name, List.copyOf(values)));
        }
        return out;
    }

    private static List<CleanVariant> variants(List<ProductOption> options, List<VariantInput> raw) {
        List<VariantInput> list = raw == null ? List.of() : raw;
        int expected = options.stream().mapToInt(o -> o.values().size()).reduce(1, (a, b) -> a * b);
        if (expected > MAX_VARIANTS) {
            throw fail("variants", "At most 100 variants");
        }
        if (list.size() != expected) {
            throw fail("variants", "Variants must cover every option combination exactly once");
        }
        Set<List<String>> combos = new HashSet<>();
        Set<String> skus = new HashSet<>();
        Set<String> barcodes = new HashSet<>();
        List<CleanVariant> out = new ArrayList<>();
        for (int i = 0; i < list.size(); i++) {
            VariantInput v = list.get(i);
            String f = "variants[" + i + "]";
            if (v == null) {
                throw fail(f, "Variant is required");
            }
            Map<String, String> opts = v.options() == null ? Map.of() : v.options();
            List<String> values = new ArrayList<>();
            for (ProductOption o : options) {
                String val = trim(opts.get(o.name()));
                String match = o.values().stream().filter(x -> x.equalsIgnoreCase(val)).findFirst().orElse(null);
                if (match == null) {
                    throw fail(f + ".options", "Unknown value for " + o.name());
                }
                values.add(match);
            }
            if (opts.size() != options.size() || !combos.add(values)) {
                throw fail(f + ".options", "Variants must cover every option combination exactly once");
            }
            if (v.price() == null || v.price().signum() <= 0) {
                throw fail(f + ".price", "Price must be more than 0");
            }
            BigDecimal price = Money.usd(v.price());
            BigDecimal compareAt = v.compareAt() == null || v.compareAt().signum() == 0 ? null : Money.usd(v.compareAt());
            if (compareAt != null && compareAt.compareTo(price) <= 0) {
                throw fail(f + ".compareAt", "Compare-at price must be more than the price");
            }
            BigDecimal cost = v.cost() == null ? null : Money.usd(v.cost());
            if (cost != null && cost.signum() < 0) {
                throw fail(f + ".cost", "Cost must not be negative");
            }
            String sku = trim(v.sku());
            if (sku.length() > 40) {
                throw fail(f + ".sku", "SKU is too long");
            }
            if (!sku.isEmpty() && !skus.add(sku.toLowerCase(Locale.ROOT))) {
                throw BusinessException.withDetail(StatusCode.DUPLICATE_SKU, f + ".sku", "SKU repeats");
            }
            String barcode = trim(v.barcode());
            if (barcode.length() > 40) {
                throw fail(f + ".barcode", "Barcode is too long");
            }
            if (!barcode.isEmpty() && !barcodes.add(barcode)) {
                throw BusinessException.withDetail(StatusCode.DUPLICATE_BARCODE, f + ".barcode", "Barcode repeats");
            }
            String swatch = trim(v.swatch());
            if (!swatch.isEmpty() && !swatch.matches("^#[0-9A-Fa-f]{3,8}$")) {
                throw fail(f + ".swatch", "Use a #RRGGBB colour");
            }
            int stock = v.stock() == null ? 0 : v.stock();
            if (stock < 0 || stock > MAX_STOCK) {
                throw fail(f + ".stock", "Stock must be 0–1000000");
            }
            out.add(new CleanVariant(trim(v.id()), List.copyOf(values), price, compareAt, cost, sku, barcode,
                    swatch.isEmpty() ? null : swatch, stock));
        }
        return out;
    }

    private static List<String> photos(List<String> raw) {
        List<String> list = raw == null ? List.of() : raw;
        if (list.size() > MAX_PHOTOS) {
            throw fail("photos", "At most 8 photos");
        }
        for (int i = 0; i < list.size(); i++) {
            String p = list.get(i);
            if (p == null || p.length() > MAX_PHOTO_CHARS
                    || !(p.startsWith("data:image/") || p.startsWith("https://") || p.startsWith("http://")
                            || p.startsWith("/api/files/"))) {
                throw fail("photos[" + i + "]", "Upload the image, or use an image URL");
            }
        }
        return List.copyOf(list);
    }

    private static List<SpecRow> specs(Map<String, String> raw) {
        if (raw == null) {
            return List.of();
        }
        if (raw.size() > 20) {
            throw fail("specs", "At most 20 detail rows");
        }
        List<SpecRow> out = new ArrayList<>();
        new LinkedHashMap<>(raw).forEach((k, v) -> {
            String label = trim(k);
            String value = trim(v);
            if (label.isEmpty() || label.length() > 40 || value.length() > 200) {
                throw fail("specs", "Labels 1–40 and values up to 200 characters");
            }
            out.add(new SpecRow(label, value));
        });
        return out;
    }

    private static String trim(String s) {
        return s == null ? "" : s.trim();
    }

    private static BusinessException fail(String field, String message) {
        return BusinessException.withDetail(StatusCode.VALIDATION_FAILED, field, message);
    }
}
