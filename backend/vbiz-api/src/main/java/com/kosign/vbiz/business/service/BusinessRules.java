package com.kosign.vbiz.business.service;

import java.text.Normalizer;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.fasterxml.jackson.databind.JsonNode;
import com.kosign.vbiz.business.domain.Closure;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;

/** Pure validation and shaping rules for businesses (Create Business prototype). */
public final class BusinessRules {

    /** Bakong ID such as {@code nita@aba} (prototype {@code BAKONG_ID}). */
    public static final Pattern BAKONG_ID = Pattern.compile("^[a-z0-9._-]+@[a-z]+$", Pattern.CASE_INSENSITIVE);

    /** Largest ID photo accepted (prototype: 8 MB). */
    public static final int MAX_ID_PHOTO_BYTES = 8_000_000;

    private static final Set<String> PHOTO_TYPES =
            Set.of("image/png", "image/jpeg", "image/jpg", "image/webp", "image/heic", "image/heif", "application/pdf");
    private static final Pattern DATA_URL = Pattern.compile("^data:([a-z]+/[a-z0-9.+-]+);base64,(.+)$",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern HHMM = Pattern.compile("^([01]\\d|2[0-3]):([0-5]\\d)$|^24:00$");
    private static final int DAY_MINUTES = 24 * 60;

    private BusinessRules() {
    }

    /** {@code "Nita Gadget Store"} → {@code "nita-gadget-store"} (prototype {@code slug()}); "shop" when empty. */
    public static String slugify(String name) {
        String ascii = Normalizer.normalize(name == null ? "" : name, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "");
        String slug = ascii.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
        if (slug.length() > 80) {
            slug = slug.substring(0, 80).replaceAll("-+$", "");
        }
        return slug.isEmpty() ? "shop" : slug;
    }

    public static String bakongId(String raw) {
        String v = raw == null ? "" : raw.trim();
        if (!BAKONG_ID.matcher(v).matches()) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "bakongId", "Not a valid Bakong ID");
        }
        return v;
    }

    /** "HH:MM" → minutes from midnight. */
    public static int minutes(String hhmm, String field) {
        Matcher m = HHMM.matcher(hhmm == null ? "" : hhmm.trim());
        if (!m.matches()) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, field, "Use HH:MM");
        }
        if (m.group(1) == null) {
            return DAY_MINUTES; // 24:00
        }
        return Integer.parseInt(m.group(1)) * 60 + Integer.parseInt(m.group(2));
    }

    /** Monday–Saturday {@code open}–{@code close}; Sunday the same when {@code sunday}, else closed. */
    public static List<List<Integer>> weekFromForm(String open, String close, boolean sunday) {
        int o = minutes(open, "hours.open");
        int c = minutes(close, "hours.close");
        if (c <= o) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "hours.close",
                    "Closing time must be after opening time");
        }
        List<Integer> day = List.of(o, c);
        List<List<Integer>> week = new ArrayList<>(Collections.nCopies(6, day));
        week.add(sunday ? day : null);
        return week;
    }

    /** Accepts 7 entries ({@code [open, close]} minutes or null) or the {@code {open, close, sunday}} form. */
    public static List<List<Integer>> weekFromJson(JsonNode node) {
        return weekFromJson(node, "hours");
    }

    /** 7 days of {@code [startMin, endMin]} or null (opening hours, staff shifts); errors name {@code field}. */
    public static List<List<Integer>> weekFromJson(JsonNode node, String field) {
        if (node.isObject() && field.equals("hours")) {
            return weekFromForm(node.path("open").asText(null), node.path("close").asText(null),
                    node.path("sunday").asBoolean(false));
        }
        if (!node.isArray() || node.size() != 7) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, field, "Need 7 days");
        }
        List<List<Integer>> week = new ArrayList<>(7);
        for (int i = 0; i < 7; i++) {
            JsonNode d = node.get(i);
            if (d == null || d.isNull()) {
                week.add(null);
                continue;
            }
            if (!d.isArray() || d.size() != 2 || !d.get(0).canConvertToInt() || !d.get(1).canConvertToInt()) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, field + "[" + i + "]",
                        "Use [startMinutes, endMinutes] or null");
            }
            int o = d.get(0).asInt();
            int c = d.get(1).asInt();
            if (o < 0 || c > DAY_MINUTES || c <= o) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, field + "[" + i + "]",
                        "The end must be after the start");
            }
            week.add(List.of(o, c));
        }
        return week;
    }

    public static List<Closure> closures(List<Closure> input) {
        List<Closure> out = new ArrayList<>(input.size());
        for (int i = 0; i < input.size(); i++) {
            Closure c = input.get(i);
            try {
                LocalDate.parse(c == null || c.date() == null ? "" : c.date());
            } catch (DateTimeParseException ex) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "closures[" + i + "].date",
                        "Use YYYY-MM-DD");
            }
            String reason = c.reason() == null ? "" : c.reason().trim();
            if (reason.length() > 120) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "closures[" + i + "].reason",
                        "Reason is too long");
            }
            out.add(new Closure(c.date(), reason));
        }
        return out;
    }

    /** A decoded data URL. */
    public record DataUrl(String contentType, byte[] bytes) {
    }

    public static DataUrl decodeIdPhoto(String dataUrl) {
        Matcher m = DATA_URL.matcher(dataUrl.trim());
        if (!m.matches()) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "idPhoto", "Not a base64 data URL");
        }
        String type = m.group(1).toLowerCase(Locale.ROOT);
        if (!PHOTO_TYPES.contains(type)) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "idPhoto", "Unsupported file type");
        }
        byte[] bytes;
        try {
            bytes = Base64.getMimeDecoder().decode(m.group(2));
        } catch (IllegalArgumentException ex) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "idPhoto", "Not valid base64");
        }
        if (bytes.length == 0 || bytes.length > MAX_ID_PHOTO_BYTES) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "idPhoto", "Photo must be 8 MB or smaller");
        }
        return new DataUrl(type.equals("image/jpg") ? "image/jpeg" : type, bytes);
    }
}
