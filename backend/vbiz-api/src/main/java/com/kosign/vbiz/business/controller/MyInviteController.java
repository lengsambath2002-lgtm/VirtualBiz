package com.kosign.vbiz.business.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.business.payload.JoinedResponse;
import com.kosign.vbiz.business.service.TeamService;
import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.common.security.CurrentUser;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

/**
 * Signed in: accept a team invite sent to your own email, with no password (docs/api/phase10-shop-team.md).
 * The shop is added to your workspaces with the invite's role.
 */
@Tag(name = "Team invites")
@RestController
@RequestMapping("/api/me/invites")
@RequiredArgsConstructor
public class MyInviteController extends BaseController {

    private final TeamService team;

    @PostMapping("/{token}/accept")
    public ResponseEntity<ApiResponse<JoinedResponse>> accept(@PathVariable String token) {
        return ok(team.acceptAsMe(CurrentUser.id(), token));
    }
}
