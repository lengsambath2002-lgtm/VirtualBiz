package com.kosign.vbiz.booking;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;

import com.fasterxml.jackson.databind.JsonNode;
import com.kosign.vbiz.support.IntegrationTest;

/** Shared helpers for the booking and provider workspace integration tests (Glow Beauty Salon). */
public abstract class BookingTestSupport extends IntegrationTest {

    /** Haircut & Style: 45 min, $8, Try Dana or Vicheka. */
    protected static final String CUT = "cccccccc-0000-4000-8000-000000000008";
    protected static final String CUT_SLUG = "glow-cut";
    /** Gel Manicure: 60 min, $18 with 10% off online, Srey Leak. */
    protected static final String GEL_SLUG = "glow-gel";
    /** Keratin Treatment: not bookable online. */
    protected static final String KERA_SLUG = "glow-kera";
    protected static final String DANA_ID = "33333333-3333-4333-8333-000000000002";
    protected static final String LEAK_ID = "33333333-3333-4333-8333-000000000101";
    protected static final String VICHEKA_ID = "33333333-3333-4333-8333-000000000102";
    /** Argan hair oil, $12, sold at the counter. */
    protected static final String ARGAN = "bbbbbbbb-0000-4000-8000-000201000000";
    protected static final ZoneId PP = ZoneId.of("Asia/Phnom_Penh");

    @Autowired
    protected JdbcTemplate jdbc;

    protected static LocalDate today() {
        return LocalDate.now(PP);
    }

    /**
     * The first Monday–Thursday at least {@code minDays} ahead that is not one of the seeded
     * closures (today + 9, today + 23): Dana and Vicheka both work then and nothing is seeded.
     */
    protected static LocalDate workday(int minDays) {
        LocalDate d = today().plusDays(minDays);
        while (d.getDayOfWeek().getValue() > DayOfWeek.THURSDAY.getValue() || d.equals(today().plusDays(9))
                || d.equals(today().plusDays(23))) {
            d = d.plusDays(1);
        }
        return d;
    }

    /** Like {@link #workday} but a day Srey Leak works too (she is off on Wednesdays). */
    protected static LocalDate leakDay(int minDays) {
        LocalDate d = workday(minDays);
        while (d.getDayOfWeek() == DayOfWeek.WEDNESDAY) {
            d = workday((int) java.time.temporal.ChronoUnit.DAYS.between(today(), d) + 1);
        }
        return d;
    }

    protected JsonNode shop(Session s, String method, String path, Object body) throws Exception {
        return shop(s, GLOW_BEAUTY_ID, method, path, body);
    }

    protected JsonNode shop(Session s, String businessId, String method, String path, Object body) throws Exception {
        var req = switch (method) {
            case "GET" -> get(path);
            case "PATCH" -> patch(path);
            case "DELETE" -> delete(path);
            default -> post(path);
        };
        req.header("Authorization", s.bearer()).header("X-Business-Id", businessId);
        if (body != null) {
            req.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        }
        return body(mvc.perform(req).andReturn());
    }

    protected JsonNode as(Session s, String method, String path, Object body) throws Exception {
        var req = method.equals("GET") ? get(path) : post(path);
        req.header("Authorization", s.bearer());
        if (body != null) {
            req.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        }
        return body(mvc.perform(req).andReturn());
    }

    protected static Map<String, Object> booking(String service, String staffId, LocalDate date, int start) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("service", service);
        if (staffId != null) {
            m.put("staffId", staffId);
        }
        m.put("date", date.toString());
        m.put("start", start);
        m.put("name", "Sok Dara");
        m.put("phone", uniquePhone());
        return m;
    }

    protected Session customer() throws Exception {
        return signUp("Sok Dara", uniqueEmail("booker"), "Bright#2026");
    }

    protected static String code(JsonNode r) {
        return r.path("status").path("code").asText();
    }
}
