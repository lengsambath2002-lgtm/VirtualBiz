package com.kosign.vbiz.common.imports;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Reads one import row and collects its problems, so a whole file is checked before anything is
 * saved. Column names match the export's headers, so an exported file imports back.
 */
public final class RowCheck {

    private final Map<String, String> row;
    private final int line;
    private final List<ImportReport.RowError> errors = new ArrayList<>();

    public RowCheck(Map<String, String> row, int index) {
        this.row = row;
        this.line = index + 2;
    }

    public int line() {
        return line;
    }

    public boolean ok() {
        return errors.isEmpty();
    }

    public List<ImportReport.RowError> errors() {
        return errors;
    }

    public void error(String field, String message) {
        errors.add(new ImportReport.RowError(line, field, message));
    }

    /** Trimmed text, or {@code null} when the column is missing or blank. */
    public String text(String col) {
        String v = row.get(col);
        return v == null || v.isBlank() ? null : v.trim();
    }

    public boolean has(String col) {
        return row.containsKey(col);
    }

    public String required(String col, int max) {
        String v = text(col);
        if (v == null) {
            error(col, "Required");
        } else if (v.length() > max) {
            error(col, "At most " + max + " characters");
            return null;
        }
        return v;
    }

    public String optional(String col, int max) {
        String v = text(col);
        if (v != null && v.length() > max) {
            error(col, "At most " + max + " characters");
            return null;
        }
        return v;
    }

    /** USD with up to 2 decimals, 0 – 1,000,000; "$" and thousands commas are allowed. */
    public BigDecimal money(String col, boolean required) {
        String v = text(col);
        if (v == null) {
            if (required) {
                error(col, "Required");
            }
            return null;
        }
        try {
            BigDecimal d = new BigDecimal(v.replace("$", "").replace(",", "").trim());
            if (d.signum() < 0 || d.compareTo(new BigDecimal("1000000")) > 0 || d.scale() > 2) {
                error(col, "An amount from 0 to 1,000,000 with at most 2 decimals");
                return null;
            }
            return d.setScale(2, RoundingMode.UNNECESSARY);
        } catch (NumberFormatException e) {
            error(col, "Not a number");
            return null;
        }
    }

    /** A whole number in [min, max]. */
    public Integer integer(String col, int min, int max, boolean required) {
        String v = text(col);
        if (v == null) {
            if (required) {
                error(col, "Required");
            }
            return null;
        }
        try {
            int n = Integer.parseInt(v.replace(",", ""));
            if (n < min || n > max) {
                error(col, "A whole number from " + min + " to " + max);
                return null;
            }
            return n;
        } catch (NumberFormatException e) {
            error(col, "Not a whole number");
            return null;
        }
    }
}
