package com.kosign.vbiz.admin.payload;

import java.util.List;

/** One page of an admin list: {@code page} is 0-based, {@code total} counts every match. */
public record PageResponse<T>(List<T> items, long total, int page, int size) {
}
