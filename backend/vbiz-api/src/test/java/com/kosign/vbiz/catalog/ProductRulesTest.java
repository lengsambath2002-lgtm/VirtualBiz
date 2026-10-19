package com.kosign.vbiz.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.kosign.vbiz.catalog.domain.ProductStatus;
import com.kosign.vbiz.catalog.payload.OptionInput;
import com.kosign.vbiz.catalog.payload.ProductInput;
import com.kosign.vbiz.catalog.payload.VariantInput;
import com.kosign.vbiz.catalog.service.ProductRules;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;

class ProductRulesTest {

    private static VariantInput v(Map<String, String> opts, String price) {
        return new VariantInput(null, opts, new BigDecimal(price), null, null, "", "", null, 0);
    }

    private static ProductInput product(List<OptionInput> options, List<VariantInput> variants) {
        return new ProductInput(" Tee ", null, null, ProductStatus.ACTIVE, null, options, variants, null,
                Map.of("Fit", "Relaxed"));
    }

    private static StatusCode code(Runnable r) {
        try {
            r.run();
            return null;
        } catch (BusinessException e) {
            return e.getStatusCode();
        }
    }

    @Test
    void accepts_a_full_matrix_and_normalises() {
        var opts = List.of(new OptionInput("Size", List.of("S", "M")), new OptionInput("Colour", List.of("Red")));
        var clean = ProductRules.validate(product(opts, List.of(
                v(Map.of("Size", "S", "Colour", "Red"), "5.5"), v(Map.of("Size", "m", "Colour", "red"), "6"))));
        assertThat(clean.title()).isEqualTo("Tee");
        assertThat(clean.lowStockAt()).isEqualTo(5);
        assertThat(clean.variants().get(1).values()).containsExactly("M", "Red");
        assertThat(clean.variants().get(0).price()).isEqualByComparingTo("5.50");
        assertThat(clean.specs().get(0).label()).isEqualTo("Fit");
    }

    @Test
    void rejects_bad_matrices_and_prices() {
        var opts = List.of(new OptionInput("Size", List.of("S", "M")));
        assertThat(code(() -> ProductRules.validate(product(opts, List.of(v(Map.of("Size", "S"), "5"))))))
                .isEqualTo(StatusCode.VALIDATION_FAILED);
        assertThat(code(() -> ProductRules.validate(product(opts,
                List.of(v(Map.of("Size", "S"), "5"), v(Map.of("Size", "S"), "5"))))))
                .isEqualTo(StatusCode.VALIDATION_FAILED);
        assertThat(code(() -> ProductRules.validate(product(List.of(), List.of(v(Map.of(), "0"))))))
                .isEqualTo(StatusCode.VALIDATION_FAILED);
        assertThat(code(() -> ProductRules.validate(product(
                List.of(new OptionInput("A", List.of("1")), new OptionInput("a", List.of("2"))), List.of()))))
                .isEqualTo(StatusCode.VALIDATION_FAILED);
        assertThat(code(() -> ProductRules.validate(product(List.of(),
                List.of(new VariantInput(null, Map.of(), BigDecimal.TEN, BigDecimal.ONE, null, "", "", null, 0))))))
                .isEqualTo(StatusCode.VALIDATION_FAILED);
    }

    @Test
    void repeated_sku_inside_the_product() {
        var opts = List.of(new OptionInput("Size", List.of("S", "M")));
        assertThatThrownBy(() -> ProductRules.validate(product(opts, List.of(
                new VariantInput(null, Map.of("Size", "S"), BigDecimal.ONE, null, null, "X", "", null, 0),
                new VariantInput(null, Map.of("Size", "M"), BigDecimal.ONE, null, null, "x", "", null, 0)))))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getStatusCode()).isEqualTo(StatusCode.DUPLICATE_SKU);
    }
}
