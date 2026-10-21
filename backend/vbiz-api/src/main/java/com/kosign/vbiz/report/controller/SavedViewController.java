package com.kosign.vbiz.report.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.common.api.EmptyJsonResponse;
import com.kosign.vbiz.report.payload.SavedViewInput;
import com.kosign.vbiz.report.payload.SavedViewResponse;
import com.kosign.vbiz.report.service.SavedViewService;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** The signed-in person's saved list views. */
@Tag(name = "Saved views")
@RestController
@RequestMapping("/api/me/views")
@RequiredArgsConstructor
public class SavedViewController extends BaseController {

    private final SavedViewService views;

    @GetMapping
    public ResponseEntity<ApiResponse<List<SavedViewResponse>>> list(@RequestParam String list) {
        return ok(views.list(list));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<SavedViewResponse>> save(@Valid @RequestBody SavedViewInput in) {
        return ok(views.save(in));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<EmptyJsonResponse>> delete(@PathVariable UUID id) {
        views.delete(id);
        return ok();
    }
}
