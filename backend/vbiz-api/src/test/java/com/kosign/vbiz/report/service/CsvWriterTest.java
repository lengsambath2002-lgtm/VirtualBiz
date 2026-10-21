package com.kosign.vbiz.report.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

import org.junit.jupiter.api.Test;

class CsvWriterTest {

    @Test
    void text_is_quoted_and_formulas_are_defused() {
        assertThat(CsvWriter.cell("Sok \"Dara\", BKK1")).isEqualTo("\"Sok \"\"Dara\"\", BKK1\"");
        assertThat(CsvWriter.cell("=1+2")).isEqualTo("\"'=1+2\"");
        assertThat(CsvWriter.cell("+855 12 345 678")).isEqualTo("\"'+855 12 345 678\"");
        assertThat(CsvWriter.cell("@SUM(A1)")).isEqualTo("\"'@SUM(A1)\"");
        assertThat(CsvWriter.cell("ផ្កា")).isEqualTo("\"ផ្កា\"");
        assertThat(CsvWriter.cell(null)).isEmpty();
    }

    @Test
    void numbers_and_times_are_plain() {
        assertThat(CsvWriter.cell(new BigDecimal("-5"))).isEqualTo("-5.00");
        assertThat(CsvWriter.cell(new BigDecimal("12.345"))).isEqualTo("12.35");
        assertThat(CsvWriter.cell(3)).isEqualTo("3");
        assertThat(CsvWriter.cell(true)).isEqualTo("true");
        assertThat(CsvWriter.cell(Instant.parse("2026-10-20T18:30:00Z"))).isEqualTo("2026-10-21 01:30");
    }

    @Test
    void the_file_starts_with_a_bom_and_uses_crlf() {
        CsvWriter w = new CsvWriter("A", "B").row("x", 1);
        assertThat(w.rows()).isEqualTo(1);
        assertThat(new String(w.bytes(), StandardCharsets.UTF_8)).isEqualTo("﻿\"A\",\"B\"\r\n\"x\",1\r\n");
    }
}
