package com.kosign.vbiz.catalog.domain;

import java.util.List;

/** A product option such as Colour with its values in display order. Stored in {@code product.options}. */
public record ProductOption(String name, List<String> values) {
}
