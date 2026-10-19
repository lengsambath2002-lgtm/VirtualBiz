package com.kosign.vbiz.storage.controller;

import java.util.UUID;
import java.util.concurrent.TimeUnit;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.common.security.CurrentUser;
import com.kosign.vbiz.storage.domain.FilePurpose;
import com.kosign.vbiz.storage.payload.FileResponse;
import com.kosign.vbiz.storage.service.StorageService;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

/**
 * Image uploads (signed in) and serving them (public: profile and cover photos, logos and product
 * photos are shown to everyone). docs/api/phase6-files-profiles.md.
 */
@Tag(name = "Files")
@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileController extends BaseController {

    private final StorageService storage;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<FileResponse>> upload(@RequestParam("file") MultipartFile file,
            @RequestParam("purpose") FilePurpose purpose) {
        return created(storage.upload(CurrentUser.id(), purpose, file));
    }

    /** The image itself (not the JSON envelope). Ids never change content, so it caches for a year. */
    @GetMapping("/{id}")
    public ResponseEntity<byte[]> get(@PathVariable UUID id) {
        return storage.read(id)
                .map(c -> ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(c.contentType()))
                        .cacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable())
                        .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                        .header("X-Content-Type-Options", "nosniff")
                        .body(c.bytes()))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
