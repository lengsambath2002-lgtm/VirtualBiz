package com.kosign.vbiz.common.list;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.kosign.vbiz.common.error.BusinessException;

class ListParamsTest {

    private static final Map<String, String> SORTS = Map.of("placed", "o.placed_at", "total", "o.total");

    @Test
    void paging_is_clamped_and_sort_maps_to_whitelisted_sql() {
        PageQuery q = PageQuery.of(null, 500, "-total", SORTS, "-placed", "o.id");
        assertThat(q.page()).isZero();
        assertThat(q.size()).isEqualTo(100);
        assertThat(q.orderBy()).isEqualTo("o.total desc nulls last, o.id desc nulls last");
        assertThat(PageQuery.of(3, 20, null, SORTS, "-placed", "o.id").offset()).isEqualTo(60);
        assertThat(PageQuery.of(-1, 0, "placed", SORTS, "-placed", null).orderBy())
                .isEqualTo("o.placed_at asc nulls last");
    }

    @Test
    void an_unknown_sort_is_refused_not_passed_to_sql() {
        assertThatThrownBy(() -> PageQuery.of(0, 20, "total;drop table x", SORTS, "-placed", "o.id"))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void day_ranges_are_phnom_penh_days_with_an_inclusive_end() {
        DayRange r = DayRange.of(LocalDate.parse("2026-10-01"), LocalDate.parse("2026-10-21"), 366);
        assertThat(r.start()).isEqualTo(Instant.parse("2026-09-30T17:00:00Z"));
        assertThat(r.end()).isEqualTo(Instant.parse("2026-10-21T17:00:00Z"));
        assertThat(DayRange.of(null, null, 366)).isNull();
        assertThat(DayRange.of(LocalDate.parse("2026-10-01"), null, 366).end()).isNull();
        assertThatThrownBy(() -> DayRange.of(LocalDate.parse("2026-10-02"), LocalDate.parse("2026-10-01"), 366))
                .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> DayRange.of(LocalDate.parse("2025-01-01"), LocalDate.parse("2026-10-01"), 366))
                .isInstanceOf(BusinessException.class);
    }
}
