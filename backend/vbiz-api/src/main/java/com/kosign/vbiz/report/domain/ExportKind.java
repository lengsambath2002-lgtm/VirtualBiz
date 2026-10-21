package com.kosign.vbiz.report.domain;

import java.util.Arrays;
import java.util.Optional;

import com.kosign.vbiz.business.domain.BusinessType;

/** What a shop can export as CSV; {@code type} limits it to one kind of shop, {@code dated} takes a range. */
public enum ExportKind {
    ORDERS(BusinessType.PRODUCT, true),
    PRODUCTS(BusinessType.PRODUCT, false),
    SALES(null, true),
    APPOINTMENTS(BusinessType.SERVICE, true),
    CUSTOMERS(null, false);

    private final BusinessType type;
    private final boolean dated;

    ExportKind(BusinessType type, boolean dated) {
        this.type = type;
        this.dated = dated;
    }

    public BusinessType type() {
        return type;
    }

    public boolean dated() {
        return dated;
    }

    /** As in the URL: {@code /api/exports/orders}. */
    public String path() {
        return name().toLowerCase();
    }

    public static Optional<ExportKind> of(String path) {
        return Arrays.stream(values()).filter(k -> k.path().equals(path)).findFirst();
    }
}
