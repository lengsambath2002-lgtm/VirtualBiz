package com.kosign.vbiz.common.imports;

import java.util.List;
import java.util.Map;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * {@code POST /api/imports/…?dryRun=true|false&skipInvalid=true|false}: the CSV's rows as the browser
 * read them, one map per row keyed by column name.
 */
public record ImportRequest(@NotNull @Size(min = 1, max = ImportRequest.MAX_ROWS) List<Map<String, String>> rows) {

    public static final int MAX_ROWS = 5000;
}
