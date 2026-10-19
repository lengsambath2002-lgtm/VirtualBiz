package com.kosign.vbiz.business.domain;

import java.math.BigDecimal;
import java.util.List;

/** A delivery zone of a product shop: districts (by name) and the USD fee. */
public record DeliveryZone(String label, List<String> districts, BigDecimal fee) {
}
