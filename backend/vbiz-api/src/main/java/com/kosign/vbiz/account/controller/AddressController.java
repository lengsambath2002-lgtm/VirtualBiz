package com.kosign.vbiz.account.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.account.payload.AddressRequest;
import com.kosign.vbiz.account.payload.AddressResponse;
import com.kosign.vbiz.account.service.AddressService;
import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.common.security.CurrentUser;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@Tag(name = "Account")
@RestController
@RequestMapping("/api/me/addresses")
@RequiredArgsConstructor
public class AddressController extends BaseController {

    private final AddressService addresses;

    @GetMapping
    public ResponseEntity<ApiResponse<List<AddressResponse>>> list() {
        return ok(addresses.list(CurrentUser.id()));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<AddressResponse>> create(@Valid @RequestBody AddressRequest req) {
        return created(addresses.create(CurrentUser.id(), req));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<AddressResponse>> update(
            @PathVariable UUID id, @Valid @RequestBody AddressRequest req) {
        return ok(addresses.update(CurrentUser.id(), id, req));
    }

    @PostMapping("/{id}/default")
    public ResponseEntity<ApiResponse<List<AddressResponse>>> makeDefault(@PathVariable UUID id) {
        return ok(addresses.makeDefault(CurrentUser.id(), id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<List<AddressResponse>>> delete(@PathVariable UUID id) {
        return ok(addresses.delete(CurrentUser.id(), id));
    }
}
