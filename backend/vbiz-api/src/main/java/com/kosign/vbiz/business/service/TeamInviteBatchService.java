package com.kosign.vbiz.business.service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.kosign.vbiz.business.payload.TeamInviteBatchInput;
import com.kosign.vbiz.business.payload.TeamInviteBatchResponse;
import com.kosign.vbiz.business.payload.TeamInviteInput;
import com.kosign.vbiz.business.payload.TeamInviteResponse;
import com.kosign.vbiz.common.error.BusinessException;

import lombok.RequiredArgsConstructor;

/**
 * Several invites in one request (docs/api/phase10-shop-team.md). Each email goes through the single
 * invite, in its own transaction, with its own rules, activity entry and email; one that is refused
 * is reported and the others are still sent. The same address twice is sent once.
 */
@Service
@RequiredArgsConstructor
public class TeamInviteBatchService {

    private final TeamService team;

    public TeamInviteBatchResponse invite(UUID userId, UUID businessId, TeamInviteBatchInput in) {
        LinkedHashSet<String> emails = new LinkedHashSet<>();
        in.emails().forEach(e -> emails.add(e.trim().toLowerCase(Locale.ROOT)));
        List<TeamInviteResponse> sent = new ArrayList<>();
        List<TeamInviteBatchResponse.Failed> failed = new ArrayList<>();
        for (String email : emails) {
            try {
                sent.add(team.invite(userId, businessId, new TeamInviteInput(email, null, in.role(), null)));
            } catch (BusinessException e) {
                failed.add(new TeamInviteBatchResponse.Failed(email, e.getStatusCode().name(), e.getMessage()));
            }
        }
        return new TeamInviteBatchResponse(sent, failed);
    }
}
