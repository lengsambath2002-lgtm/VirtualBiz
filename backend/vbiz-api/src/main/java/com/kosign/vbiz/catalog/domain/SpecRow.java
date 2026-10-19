package com.kosign.vbiz.catalog.domain;

/** One "Details" row of a product page (label → value). Stored as an array to keep the shop's order. */
public record SpecRow(String label, String value) {
}
