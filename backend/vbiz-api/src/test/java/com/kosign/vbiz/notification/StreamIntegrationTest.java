package com.kosign.vbiz.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;
import com.kosign.vbiz.notification.sse.StreamHub;
import com.kosign.vbiz.support.IntegrationTest;

class StreamIntegrationTest extends IntegrationTest {

    @Autowired
    StreamHub hub;

    private String ticket(Session s, String businessId) throws Exception {
        var req = post("/api/stream/ticket").header("Authorization", s.bearer());
        if (businessId != null) {
            req.header("X-Business-Id", businessId);
        }
        JsonNode d = body(mvc.perform(req).andExpect(status().isOk()).andReturn()).path("data");
        assertThat(d.path("expiresIn").asInt()).isEqualTo(60);
        return d.path("ticket").asText();
    }

    @Test
    void a_ticket_opens_one_stream_once() throws Exception {
        Session nita = login(NITA, DEMO_PASSWORD);
        mvc.perform(post("/api/stream/ticket")).andExpect(status().isUnauthorized());
        String t = ticket(nita, null);
        int before = hub.connections();
        MvcResult r = mvc.perform(get("/api/stream/me").param("ticket", t)).andExpect(request().asyncStarted())
                .andReturn();
        assertThat(r.getResponse().getContentType()).startsWith("text/event-stream");
        assertThat(hub.connections()).isEqualTo(before + 1);
        // Used up.
        JsonNode reused = body(mvc.perform(get("/api/stream/me").param("ticket", t))
                .andExpect(status().isUnauthorized()).andReturn());
        assertThat(reused.path("status").path("code").asText()).isEqualTo("STREAM_TICKET_INVALID");
        mvc.perform(get("/api/stream/me").param("ticket", "nope")).andExpect(status().isUnauthorized());
        // The shop stream needs a ticket issued for the business.
        mvc.perform(get("/api/stream/business").param("ticket", ticket(nita, null)))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/stream/business").param("ticket", ticket(nita, NITA_GADGET_ID)))
                .andExpect(request().asyncStarted());
        // Not a member: the tenancy filter refuses the ticket.
        Session dana = login(DANA, DEMO_PASSWORD);
        mvc.perform(post("/api/stream/ticket").header("Authorization", dana.bearer())
                .header("X-Business-Id", NITA_GADGET_ID)).andExpect(status().isForbidden());
    }
}
