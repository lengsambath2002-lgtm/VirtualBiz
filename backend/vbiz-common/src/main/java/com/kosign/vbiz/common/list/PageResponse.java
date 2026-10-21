package com.kosign.vbiz.common.list;

import java.util.List;

/** One page of a list: {@code page} is 0-based, {@code total} counts every match. */
public record PageResponse<T>(List<T> items, long total, int page, int size) {

    /** A page of a list already filtered and sorted in memory (short lists such as platform promo codes). */
    public static <T> PageResponse<T> slice(List<T> all, int page, int size) {
        int from = (int) Math.min((long) page * size, all.size());
        int to = Math.min(from + size, all.size());
        return new PageResponse<>(List.copyOf(all.subList(from, to)), all.size(), page, size);
    }
}
