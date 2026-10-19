package com.kosign.vbiz.customer.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
