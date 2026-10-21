package com.kosign.vbiz.common.imports;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.Map;

import org.junit.jupiter.api.Test;

class RowCheckTest {

    @Test
    void reads_values_and_reports_problems_by_spreadsheet_row() {
        RowCheck r = new RowCheck(Map.of("Name", "  Sok  ", "Price (USD)", "$1,250.50", "Stock", "12",
                "Cost (USD)", "-3", "Sold", "x"), 0);
        assertThat(r.line()).isEqualTo(2);
        assertThat(r.required("Name", 80)).isEqualTo("Sok");
        assertThat(r.money("Price (USD)", true)).isEqualTo(new BigDecimal("1250.50"));
        assertThat(r.integer("Stock", 0, 100000, true)).isEqualTo(12);
        assertThat(r.ok()).isTrue();

        assertThat(r.money("Cost (USD)", false)).isNull();
        assertThat(r.integer("Sold", 0, 10, false)).isNull();
        assertThat(r.required("Phone", 20)).isNull();
        assertThat(r.errors()).extracting(ImportReport.RowError::field).containsExactly("Cost (USD)", "Sold", "Phone");
        assertThat(r.errors()).allMatch(e -> e.line() == 2);
    }

    @Test
    void money_refuses_more_than_two_decimals() {
        RowCheck r = new RowCheck(Map.of("Price (USD)", "1.234"), 4);
        assertThat(r.money("Price (USD)", true)).isNull();
        assertThat(r.errors().get(0).line()).isEqualTo(6);
    }
}
