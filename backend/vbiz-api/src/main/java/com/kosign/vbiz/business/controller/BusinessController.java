package com.kosign.vbiz.business.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.business.payload.BusinessResponse;
import com.kosign.vbiz.business.payload.CreateBusinessRequest;
import com.kosign.vbiz.business.payload.MemberInput;
import com.kosign.vbiz.business.payload.MemberResponse;
import com.kosign.vbiz.business.payload.MyBusinessResponse;
import com.kosign.vbiz.business.payload.TeamInviteInput;
import com.kosign.vbiz.business.payload.TeamInviteResponse;
import com.kosign.vbiz.business.payload.UpdateBusinessRequest;
import com.kosign.vbiz.business.service.BusinessService;
import com.kosign.vbiz.business.service.TeamService;
import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.common.security.CurrentUser;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** Businesses (docs/api/phase1-auth-account-business.md § Business). */
@Tag(name = "Business")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class BusinessController extends BaseController {

    private final BusinessService businesses;
    private final TeamService team;

    @PostMapping("/businesses")
    public ResponseEntity<ApiResponse<BusinessResponse>> create(@Valid @RequestBody CreateBusinessRequest req) {
        return created(businesses.create(CurrentUser.id(), req));
    }

    @GetMapping("/me/businesses")
    public ResponseEntity<ApiResponse<List<MyBusinessResponse>>> mine() {
        return ok(businesses.mine(CurrentUser.id()));
    }

    @GetMapping("/businesses/{id}")
    public ResponseEntity<ApiResponse<BusinessResponse>> get(@PathVariable UUID id) {
        return ok(businesses.get(CurrentUser.id(), id));
    }

    @GetMapping("/businesses/{id}/members")
    public ResponseEntity<ApiResponse<List<MemberResponse>>> members(@PathVariable UUID id) {
        return ok(businesses.members(CurrentUser.id(), id));
    }

    @PostMapping("/businesses/{id}/members")
    public ResponseEntity<ApiResponse<MemberResponse>> addMember(@PathVariable UUID id,
            @Valid @RequestBody MemberInput in) {
        return created(businesses.addMember(CurrentUser.id(), id, in));
    }

    @PatchMapping("/businesses/{id}/members/{memberId}")
    public ResponseEntity<ApiResponse<MemberResponse>> updateMember(@PathVariable UUID id,
            @PathVariable UUID memberId, @Valid @RequestBody MemberInput in) {
        return ok(businesses.updateMember(CurrentUser.id(), id, memberId, in));
    }

    @GetMapping("/businesses/{id}/invites")
    public ResponseEntity<ApiResponse<List<TeamInviteResponse>>> invites(@PathVariable UUID id) {
        return ok(team.open(CurrentUser.id(), id));
    }

    @PostMapping("/businesses/{id}/invites")
    public ResponseEntity<ApiResponse<TeamInviteResponse>> invite(@PathVariable UUID id,
            @Valid @RequestBody TeamInviteInput in) {
        return created(team.invite(CurrentUser.id(), id, in));
    }

    @DeleteMapping("/businesses/{id}/invites/{inviteId}")
    public ResponseEntity<ApiResponse<List<TeamInviteResponse>>> revokeInvite(@PathVariable UUID id,
            @PathVariable UUID inviteId) {
        team.revoke(CurrentUser.id(), id, inviteId);
        return ok(team.open(CurrentUser.id(), id));
    }

    @PatchMapping("/businesses/{id}")
    public ResponseEntity<ApiResponse<BusinessResponse>> update(
            @PathVariable UUID id, @Valid @RequestBody UpdateBusinessRequest req) {
        return ok(businesses.update(CurrentUser.id(), id, req));
    }
}
