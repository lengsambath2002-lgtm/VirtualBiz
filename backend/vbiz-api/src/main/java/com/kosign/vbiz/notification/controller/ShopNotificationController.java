package com.kosign.vbiz.notification.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.business.service.WorkspaceAccess;
import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.common.api.EmptyJsonResponse;
import com.kosign.vbiz.notification.payload.NotificationResponse;
import com.kosign.vbiz.notification.service.NotificationService;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

/** The shop's inbox, shared by its members (needs X-Business-Id). */
@Tag(name = "Notifications")
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class ShopNotificationController extends BaseController {

    private final NotificationService notifications;
    private final WorkspaceAccess access;

    @GetMapping
    public ResponseEntity<ApiResponse<List<NotificationResponse>>> list() {
        return ok(notifications.ofBusiness(access.member().businessId()));
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<ApiResponse<NotificationResponse>> read(@PathVariable UUID id) {
        return ok(notifications.readOfBusiness(access.member().businessId(), id));
    }

    @PostMapping("/read-all")
    public ResponseEntity<ApiResponse<EmptyJsonResponse>> readAll() {
        notifications.readAllOfBusiness(access.member().businessId());
        return ok();
    }
}
