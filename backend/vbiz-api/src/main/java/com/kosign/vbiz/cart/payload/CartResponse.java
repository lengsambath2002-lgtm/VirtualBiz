package com.kosign.vbiz.cart.payload;

import java.util.List;
import java.util.Map;

/** {@code Cart} on the wire. */
public record CartResponse(List<Line> lines, List<Line> later) {

    public record Line(String variantId, String productId, String productSlug, String shopSlug,
            Map<String, String> options, int qty, boolean selected) {
    }
}
