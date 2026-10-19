package com.kosign.vbiz.booking.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.booking.payload.BookingInput;
import com.kosign.vbiz.booking.payload.BookingResponse;
import com.kosign.vbiz.booking.service.BookingService;
import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.common.security.CurrentUser;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** The customer's bookings (docs/api/phase4-bookings-provider.md § Bookings). */
@Tag(name = "Bookings")
@RestController
@RequestMapping("/api/me/bookings")
@RequiredArgsConstructor
public class MyBookingController extends BaseController {

    private final BookingService bookings;

    @GetMapping
    public ResponseEntity<ApiResponse<List<BookingResponse>>> list() {
        return ok(bookings.mine(CurrentUser.id()));
    }

    @GetMapping("/{ref}")
    public ResponseEntity<ApiResponse<BookingResponse>> get(@PathVariable String ref) {
        return ok(bookings.myBooking(CurrentUser.id(), ref));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<BookingResponse>> book(@Valid @RequestBody BookingInput in) {
        return created(bookings.book(CurrentUser.id(), in));
    }

    @PostMapping("/{ref}/cancel")
    public ResponseEntity<ApiResponse<BookingResponse>> cancel(@PathVariable String ref) {
        return ok(bookings.cancel(CurrentUser.id(), ref));
    }
}
