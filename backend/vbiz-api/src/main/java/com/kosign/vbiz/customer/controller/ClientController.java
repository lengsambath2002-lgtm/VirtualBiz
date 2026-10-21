package com.kosign.vbiz.customer.controller;

import java.util.List;
import java.util.UUID;

import java.time.LocalDate;

import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.customer.payload.ClientRow;
import com.kosign.vbiz.common.list.PageResponse;
import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.customer.payload.ClientInput;
import com.kosign.vbiz.customer.payload.ClientResponse;
import com.kosign.vbiz.customer.service.ClientService;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** A service business's clients (docs/api/phase4-bookings-provider.md § Clients). Needs X-Business-Id. */
@Tag(name = "Clients")
@RestController
@RequestMapping("/api/clients")
@RequiredArgsConstructor
public class ClientController extends BaseController {

    private final ClientService clients;

    /** A page of customers with lifetime numbers; the list contract (sort, page, size, from / to joined). */
    @GetMapping("/page")
    public ResponseEntity<ApiResponse<PageResponse<ClientRow>>> page(@RequestParam(required = false) String q,
            @RequestParam(required = false) String district, @RequestParam(required = false) String segment,
            @RequestParam(required = false) String account,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String sort, @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ok(clients.page(q, district, segment, account, from, to, sort, page, size));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<ClientResponse>>> list() {
        return ok(clients.list());
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ClientResponse>> create(@Valid @RequestBody ClientInput in) {
        return created(clients.create(in));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ApiResponse<ClientResponse>> update(@PathVariable UUID id, @Valid @RequestBody ClientInput in) {
        return ok(clients.update(id, in));
    }
}
