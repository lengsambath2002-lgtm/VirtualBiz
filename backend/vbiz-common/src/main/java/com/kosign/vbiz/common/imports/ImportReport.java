package com.kosign.vbiz.common.imports;

import java.util.List;

/**
 * What an import did, or would do ({@code applied = false} for a dry run). {@code line} in an error is
 * the spreadsheet row: 2 for the first row under the header.
 */
public record ImportReport(int total, int created, int updated, int skipped, List<RowError> errors,
        boolean applied) {

    public record RowError(int line, String field, String message) {
    }
}
