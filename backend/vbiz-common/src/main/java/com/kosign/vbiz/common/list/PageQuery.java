package com.kosign.vbiz.common.list;

import java.util.Map;

import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;

/**
 * Paging and sorting from a list request ({@code ?page=0&size=20&sort=-total}). {@code page} is
 * 0-based; {@code size} 1–100 (default 20); {@code sort} is one of the list's keys, {@code -} for
 * descending. Each list maps its sort keys to the SQL it orders by, so nothing from the request
 * reaches the query text.
 */
public record PageQuery(int page, int size, String sortKey, boolean desc, String orderBy) {

    public static final int MAX_SIZE = 100;

    /**
     * @param sorts       the list's sort keys mapped to an SQL expression (e.g. {@code "total" → "o.total"})
     * @param defaultSort used without {@code sort}, e.g. {@code "-placed"}
     * @param tieBreak    appended to every order (a unique column, so pages never overlap)
     */
    public static PageQuery of(Integer page, Integer size, String sort, Map<String, String> sorts, String defaultSort,
            String tieBreak) {
        int p = page == null || page < 0 ? 0 : page;
        int s = size == null ? 20 : Math.max(1, Math.min(MAX_SIZE, size));
        String raw = sort == null || sort.isBlank() ? defaultSort : sort.trim();
        boolean desc = raw.startsWith("-");
        String key = desc ? raw.substring(1) : raw;
        String expr = sorts.get(key);
        if (expr == null) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "sort", "one of " + sorts.keySet());
        }
        String dir = desc ? " desc nulls last" : " asc nulls last";
        return new PageQuery(p, s, key, desc, expr + dir + (tieBreak == null ? "" : ", " + tieBreak + dir));
    }

    public long offset() {
        return (long) page * size;
    }
}
