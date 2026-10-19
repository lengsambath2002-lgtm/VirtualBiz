package com.kosign.vbiz.account.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.account.payload.SavedEntryResponse;
import com.kosign.vbiz.account.service.SavedService;
import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.common.security.CurrentUser;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

/** Saved items and followed shops (docs/api/phase2-catalog-inventory.md § Saved). */
@Tag(name = "Account")
@RestController
@RequestMapping("/api/me/saved")
@RequiredArgsConstructor
public class SavedController extends BaseController {

    private final SavedService saved;

    @GetMapping
    public ResponseEntity<ApiResponse<List<SavedEntryResponse>>> list() {
        return ok(saved.list(CurrentUser.id()));
    }

    @PutMapping("/{key}")
    public ResponseEntity<ApiResponse<List<SavedEntryResponse>>> save(@PathVariable String key) {
        return ok(saved.save(CurrentUser.id(), key));
    }

    @DeleteMapping("/{key}")
    public ResponseEntity<ApiResponse<List<SavedEntryResponse>>> remove(@PathVariable String key) {
        return ok(saved.remove(CurrentUser.id(), key));
    }
}
