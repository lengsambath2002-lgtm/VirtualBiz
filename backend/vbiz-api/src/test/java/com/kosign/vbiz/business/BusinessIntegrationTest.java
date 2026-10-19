package com.kosign.vbiz.business;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Base64;
import java.util.HashMap;

import java.util.Map;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import com.kosign.vbiz.support.IntegrationTest;

class BusinessIntegrationTest extends IntegrationTest {

    private static final String PASSWORD = "Str0ng!Pass";

    @Test
    void seeded_owners_see_their_businesses() throws Exception {
        Session nita = login(NITA, DEMO_PASSWORD);
        mvc.perform(get("/api/me/businesses").header("Authorization", nita.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].id").value(NITA_GADGET_ID))
                .andExpect(jsonPath("$.data[0].name").value("Nita Gadget Store"))
                .andExpect(jsonPath("$.data[0].type").value("PRODUCT"))
                .andExpect(jsonPath("$.data[0].role").value("OWNER"))
                .andExpect(jsonPath("$.data[0].verification").value("VERIFIED"));
        mvc.perform(get("/api/businesses/" + NITA_GADGET_ID).header("Authorization", nita.bearer())
                        .header("X-Business-Id", NITA_GADGET_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.slug").value("nita-gadget"))
                .andExpect(jsonPath("$.data.hours.length()").value(7))
                .andExpect(jsonPath("$.data.hours[6][0]").value(600))
                .andExpect(jsonPath("$.data.productSettings.zones.length()").value(3))
                .andExpect(jsonPath("$.data.bookingSettings").doesNotExist());

        Session dana = login(DANA, DEMO_PASSWORD);
        mvc.perform(get("/api/me/businesses").header("Authorization", dana.bearer()))
                .andExpect(jsonPath("$.data[0].id").value(GLOW_BEAUTY_ID))
                .andExpect(jsonPath("$.data[0].type").value("SERVICE"));
    }

    @Test
    void tenancy_rejects_non_members() throws Exception {
        Session dana = login(DANA, DEMO_PASSWORD);
        // header names a business Dana is not in: the tenancy filter stops it
        mvc.perform(get("/api/me").header("Authorization", dana.bearer()).header("X-Business-Id", NITA_GADGET_ID))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status.code").value("FORBIDDEN_TENANT"));
        mvc.perform(get("/api/me").header("Authorization", dana.bearer()).header("X-Business-Id", "not-a-uuid"))
                .andExpect(jsonPath("$.status.code").value("FORBIDDEN_TENANT"));
        // and without the header the service still checks membership
        mvc.perform(get("/api/businesses/" + NITA_GADGET_ID).header("Authorization", dana.bearer()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status.code").value("FORBIDDEN_TENANT"));
        // header for her own business but path for another
        mvc.perform(get("/api/businesses/" + NITA_GADGET_ID).header("Authorization", dana.bearer())
                        .header("X-Business-Id", GLOW_BEAUTY_ID))
                .andExpect(jsonPath("$.status.code").value("FORBIDDEN_TENANT"));
        mvc.perform(patch("/api/businesses/" + NITA_GADGET_ID).header("Authorization", dana.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"online\":false}"))
                .andExpect(jsonPath("$.status.code").value("FORBIDDEN_TENANT"));
        mvc.perform(get("/api/businesses/00000000-0000-4000-8000-000000000000").header("Authorization", dana.bearer()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status.code").value("BUSINESS_NOT_FOUND"));
    }

    @Test
    void create_product_business_with_slug_collision_and_patch() throws Exception {
        Session s = signUp("Shop Owner", uniqueEmail("owner"), PASSWORD);
        String photo = "data:image/png;base64," + Base64.getEncoder().encodeToString(new byte[] {1, 2, 3, 4});

        Map<String, Object> req = createBody("PRODUCT", "Happy Coffee", "cafe-food", photo);
        String id = body(mvc.perform(post("/api/businesses").header("Authorization", s.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.slug").value("happy-coffee-2")) // seeded shop owns happy-coffee
                .andExpect(jsonPath("$.data.categoryId").value("cafe"))
                .andExpect(jsonPath("$.data.verification").value("PENDING"))
                .andExpect(jsonPath("$.data.online").value(true))
                .andExpect(jsonPath("$.data.district").value("Toul Kork"))
                .andExpect(jsonPath("$.data.phone").value("012345678"))
                .andExpect(jsonPath("$.data.hours[0]", Matchers.contains(480, 1080)))
                .andExpect(jsonPath("$.data.hours[6]").value(Matchers.nullValue()))
                .andExpect(jsonPath("$.data.rating").value(0.0))
                .andExpect(jsonPath("$.data.productSettings.autoAccept").value(false))
                .andExpect(jsonPath("$.data.productSettings.prepMinutes").value(20))
                .andExpect(jsonPath("$.data.productSettings.zones.length()").value(3))
                .andExpect(jsonPath("$.data.productSettings.freeDeliveryOver").doesNotExist())
                .andReturn()).path("data").path("id").asText();

        mvc.perform(post("/api/businesses").header("Authorization", s.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(req)))
                .andExpect(jsonPath("$.data.slug").value("happy-coffee-3"));

        mvc.perform(get("/api/me/businesses").header("Authorization", s.bearer()))
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].id").value(id))
                .andExpect(jsonPath("$.data[0].role").value("OWNER"))
                .andExpect(jsonPath("$.data[0].verification").value("PENDING"));

        mvc.perform(patch("/api/businesses/" + id).header("Authorization", s.bearer()).header("X-Business-Id", id)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"about":"Best latte","online":false,
                                 "hours":[[420,1260],null,[420,1260],[420,1260],[420,1260],[420,1260],null],
                                 "closures":[{"date":"2026-11-09","reason":"Independence Day"}],
                                 "productSettings":{"autoAccept":true,"freeDeliveryOver":25}}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.about").value("Best latte"))
                .andExpect(jsonPath("$.data.online").value(false))
                .andExpect(jsonPath("$.data.hours[1]").value(Matchers.nullValue()))
                .andExpect(jsonPath("$.data.closures[0].reason").value("Independence Day"))
                .andExpect(jsonPath("$.data.productSettings.autoAccept").value(true))
                .andExpect(jsonPath("$.data.productSettings.freeDeliveryOver").value(25.0))
                .andExpect(jsonPath("$.data.productSettings.prepMinutes").value(20));

        mvc.perform(patch("/api/businesses/" + id).header("Authorization", s.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"bookingSettings\":{\"autoConfirm\":true}}"))
                .andExpect(jsonPath("$.status.code").value("VALIDATION_FAILED"));
    }

    @Test
    void create_service_business_and_validation() throws Exception {
        Session s = signUp("Salon Owner", uniqueEmail("salon"), PASSWORD);
        mvc.perform(post("/api/businesses").header("Authorization", s.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(createBody("SERVICE", "Lotus Nails", "nails", null))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.type").value("SERVICE"))
                .andExpect(jsonPath("$.data.slug").value("lotus-nails"))
                .andExpect(jsonPath("$.data.categoryId").value("beauty"))
                .andExpect(jsonPath("$.data.bookingSettings.reminderHours").value(24))
                .andExpect(jsonPath("$.data.bookingSettings.minNoticeHours").value(2))
                .andExpect(jsonPath("$.data.productSettings").doesNotExist());

        // category of the wrong type
        mvc.perform(post("/api/businesses").header("Authorization", s.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(createBody("SERVICE", "Wrong", "cafe", null))))
                .andExpect(jsonPath("$.status.code").value("CATEGORY_NOT_FOUND"));
        Map<String, Object> bad = createBody("PRODUCT", "Bad Bakong", "grocery", null);
        bad.put("bakongId", "not a bakong");
        mvc.perform(post("/api/businesses").header("Authorization", s.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(bad)))
                .andExpect(jsonPath("$.status.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.error.details[0].field").value("bakongId"));
        Map<String, Object> hours = createBody("PRODUCT", "Bad Hours", "grocery", null);
        hours.put("hours", Map.of("open", "18:00", "close", "08:00", "sunday", false));
        mvc.perform(post("/api/businesses").header("Authorization", s.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(hours)))
                .andExpect(jsonPath("$.status.code").value("VALIDATION_FAILED"));
        mvc.perform(post("/api/businesses").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(createBody("PRODUCT", "Anon", "grocery", null))))
                .andExpect(status().isUnauthorized());
    }

    private static Map<String, Object> createBody(String type, String name, String category, String photo) {
        Map<String, Object> m = new HashMap<>();
        m.put("type", type);
        m.put("name", name);
        m.put("categoryId", category);
        m.put("district", "Toul Kork");
        m.put("street", "#22, St. 315");
        m.put("lat", 11.577);
        m.put("lng", 104.9);
        m.put("phone", "012 345 678");
        m.put("hours", Map.of("open", "08:00", "close", "18:00", "sunday", false));
        m.put("bakongId", "shop@aba");
        if (photo != null) {
            m.put("idPhoto", photo);
        }
        return m;
    }

}
