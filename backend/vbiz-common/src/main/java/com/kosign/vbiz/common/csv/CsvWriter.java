package com.kosign.vbiz.common.csv;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/**
 * RFC 4180 CSV for spreadsheets. Starts with a UTF-8 byte-order mark so Excel reads Khmer, ends rows
 * with CRLF, and quotes every text cell. Text that a spreadsheet would run as a formula (starting
 * with {@code = + - @}, tab or CR) gets a leading apostrophe; numbers are written as they are.
 */
public final class CsvWriter {

    public static final ZoneId PHNOM_PENH = ZoneId.of("Asia/Phnom_Penh");
    private static final DateTimeFormatter AT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").withZone(PHNOM_PENH);

    private final StringBuilder out = new StringBuilder("﻿");
    private int rows;

    public CsvWriter(String... header) {
        write((Object[]) header);
    }

    public CsvWriter row(Object... cells) {
        write(cells);
        rows++;
        return this;
    }

    /** Data rows written (not counting the header). */
    public int rows() {
        return rows;
    }

    public byte[] bytes() {
        return out.toString().getBytes(StandardCharsets.UTF_8);
    }

    private void write(Object... cells) {
        for (int i = 0; i < cells.length; i++) {
            if (i > 0) {
                out.append(',');
            }
            out.append(cell(cells[i]));
        }
        out.append("\r\n");
    }

    public static String cell(Object v) {
        if (v == null) {
            return "";
        }
        if (v instanceof BigDecimal d) {
            return d.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
        }
        if (v instanceof Number || v instanceof Boolean) {
            return v.toString();
        }
        if (v instanceof Instant t) {
            return AT.format(t);
        }
        if (v instanceof LocalDate d) {
            return d.toString();
        }
        String s = v.toString();
        if (!s.isEmpty() && "=+-@\t\r".indexOf(s.charAt(0)) >= 0) {
            s = "'" + s;
        }
        return '"' + s.replace("\"", "\"\"") + '"';
    }

    public static String hm(int minutes) {
        return String.format("%02d:%02d", minutes / 60, minutes % 60);
    }
}
