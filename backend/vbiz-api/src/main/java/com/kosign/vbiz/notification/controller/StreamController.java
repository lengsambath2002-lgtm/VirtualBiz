package com.kosign.vbiz.notification.controller;

import java.io.IOException;
import java.util.Optional;
import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.security.ApiErrorWriter;
import com.kosign.vbiz.common.security.CurrentUser;
import com.kosign.vbiz.common.tenancy.TenantContext;
import com.kosign.vbiz.notification.payload.StreamTicketResponse;
import com.kosign.vbiz.notification.sse.StreamHub;
import com.kosign.vbiz.notification.sse.StreamTicketService;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

/**
 * Live updates (docs/api/phase3-orders-checkout.md § Live updates). The bearer token buys a
 * single-use 60-second ticket; the {@code EventSource} opens the stream with it. The tenancy
 * filter has already checked membership when the ticket is asked for with X-Business-Id.
 */
@Tag(name = "Live updates")
@RestController
@RequestMapping("/api/stream")
@RequiredArgsConstructor
public class StreamController extends BaseController {

    private final StreamTicketService tickets;
    private final StreamHub hub;
    private final ApiErrorWriter errors;

    @PostMapping("/ticket")
    public ResponseEntity<ApiResponse<StreamTicketResponse>> ticket() {
        UUID businessId = TenantContext.getBusinessId().orElse(null);
        return ok(new StreamTicketResponse(tickets.issue(CurrentUser.id(), businessId),
                StreamTicketService.TTL.toSeconds()));
    }

    @GetMapping(path = "/me", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter me(@RequestParam(required = false) String ticket, HttpServletResponse response)
            throws IOException {
        Optional<StreamTicketService.Grant> g = tickets.redeem(ticket);
        if (g.isEmpty()) {
            errors.write(response, StatusCode.STREAM_TICKET_INVALID);
            return null;
        }
        noBuffering(response);
        return hub.subscribe(StreamHub.Scope.USER, g.get().userId());
    }

    @GetMapping(path = "/business", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter business(@RequestParam(required = false) String ticket, HttpServletResponse response)
            throws IOException {
        Optional<StreamTicketService.Grant> g = tickets.redeem(ticket);
        if (g.isEmpty() || g.get().businessId() == null) {
            errors.write(response, StatusCode.STREAM_TICKET_INVALID);
            return null;
        }
        noBuffering(response);
        return hub.subscribe(StreamHub.Scope.BUSINESS, g.get().businessId());
    }

    private static void noBuffering(HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-cache, no-transform");
        response.setHeader("X-Accel-Buffering", "no");
    }
}
