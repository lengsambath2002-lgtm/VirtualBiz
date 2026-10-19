package com.kosign.vbiz.booking.controller;

import java.time.LocalDate;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.booking.payload.AvailabilityResponse;
import com.kosign.vbiz.booking.service.BookingService;
import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

/** Free times of a service (public; docs/api/phase4-bookings-provider.md § Availability). */
@Tag(name = "Marketplace")
@RestController
@RequestMapping("/api/marketplace/items")
@RequiredArgsConstructor
public class AvailabilityController extends BaseController {

    private final BookingService bookings;

    @GetMapping("/{slug}/availability")
    public ResponseEntity<ApiResponse<AvailabilityResponse>> availability(@PathVariable String slug,
            @RequestParam(required = false) LocalDate from, @RequestParam(required = false) Integer days,
            @RequestParam(required = false) UUID staffId) {
        return ok(bookings.availability(slug, from, days, staffId));
    }
}
