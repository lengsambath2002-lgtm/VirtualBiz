package com.kosign.vbiz.pos.domain;

import java.math.BigDecimal;

/** Cash handed over for a sale: dollars, riel, and the change given back (USD). */
public record CashTender(BigDecimal usd, Long khr, BigDecimal change) {
}
