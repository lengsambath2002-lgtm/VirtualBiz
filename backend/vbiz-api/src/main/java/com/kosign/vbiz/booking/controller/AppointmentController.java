package com.kosign.vbiz.booking.controller;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.booking.service.BookingBulkService;
import com.kosign.vbiz.common.list.BulkResult;
import com.kosign.vbiz.booking.domain.AppointmentStatus;
import com.kosign.vbiz.booking.domain.AppointmentSource;
import com.kosign.vbiz.common.list.PageResponse;
import com.kosign.vbiz.booking.payload.AppointmentInputs;
import com.kosign.vbiz.booking.payload.AppointmentResponse;
import com.kosign.vbiz.booking.service.AppointmentService;
import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** The provider's calendar (docs/api/phase4-bookings-provider.md § Appointments). Needs X-Business-Id. */
@Tag(name = "Appointments")
@RestController
@RequestMapping("/api/appointments")
@RequiredArgsConstructor
public class AppointmentController extends BaseController {

    private final AppointmentService appointments;
    private final BookingBulkService bulk;

    @GetMapping
    public ResponseEntity<ApiResponse<List<AppointmentResponse>>> list(@RequestParam(required = false) LocalDate from,
            @RequestParam(required = false) LocalDate to) {
        return ok(appointments.list(from, to));
    }

    /** The appointments as a filtered list, a page at a time (the calendar uses {@code GET} with from / to). */
    @GetMapping("/list")
    public ResponseEntity<ApiResponse<PageResponse<AppointmentResponse>>> page(
            @RequestParam(required = false) AppointmentStatus status, @RequestParam(required = false) UUID staffId,
            @RequestParam(required = false) UUID serviceId, @RequestParam(required = false) AppointmentSource source,
            @RequestParam(required = false) LocalDate from, @RequestParam(required = false) LocalDate to,
            @RequestParam(required = false) String q, @RequestParam(required = false) String sort,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return ok(appointments.page(status, staffId, serviceId, source, from, to, q, sort, page, size));
    }

    @GetMapping("/{ref}")
    public ResponseEntity<ApiResponse<AppointmentResponse>> get(@PathVariable String ref) {
        return ok(appointments.get(ref));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<AppointmentResponse>> create(@Valid @RequestBody AppointmentInputs.Create in) {
        return created(appointments.create(in));
    }

    @PatchMapping("/{ref}")
    public ResponseEntity<ApiResponse<AppointmentResponse>> update(@PathVariable String ref,
            @Valid @RequestBody AppointmentInputs.Patch in) {
        return ok(appointments.update(ref, in));
    }

    /** The same status for up to 100 appointments ({@code refs}: ids or numbers). */
    @PostMapping("/bulk-status")
    public ResponseEntity<ApiResponse<BulkResult>> bulkStatus(@Valid @RequestBody AppointmentInputs.BulkStatus in) {
        return ok(bulk.setStatus(in.refs(), in.status()));
    }

    @PostMapping("/{ref}/status")
    public ResponseEntity<ApiResponse<AppointmentResponse>> status(@PathVariable String ref,
            @Valid @RequestBody AppointmentInputs.Status in) {
        return ok(appointments.setStatus(ref, in));
    }

    @PostMapping("/{ref}/undo")
    public ResponseEntity<ApiResponse<AppointmentResponse>> undo(@PathVariable String ref) {
        return ok(appointments.undo(ref));
    }
}
