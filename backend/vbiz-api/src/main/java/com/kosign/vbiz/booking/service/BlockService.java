package com.kosign.vbiz.booking.service;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.booking.domain.CalendarBlock;
import com.kosign.vbiz.booking.payload.BlockInput;
import com.kosign.vbiz.booking.payload.BlockResponse;
import com.kosign.vbiz.booking.repository.CalendarBlockRepository;
import com.kosign.vbiz.business.domain.BusinessType;
import com.kosign.vbiz.business.repository.BusinessMemberRepository;
import com.kosign.vbiz.business.service.WorkspaceAccess;
import com.kosign.vbiz.business.service.WorkspaceAccess.Workspace;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.notification.sse.StreamEvent;

import lombok.RequiredArgsConstructor;

/** Calendar blocks (docs/api/phase4-bookings-provider.md § Blocks). Any member. */
@Service
@RequiredArgsConstructor
public class BlockService {

    private final CalendarBlockRepository blocks;
    private final BusinessMemberRepository members;
    private final WorkspaceAccess access;
    private final BookingProperties props;
    private final AppointmentService calendar;
    private final org.springframework.context.ApplicationEventPublisher events;

    @Transactional(readOnly = true)
    public List<BlockResponse> list(LocalDate from, LocalDate to) {
        Workspace w = workspace();
        LocalDate today = calendar.today();
        LocalDate f = from == null ? today.minusDays(props.pastDays()) : from;
        LocalDate t = to == null ? today.plusDays(props.futureDays()) : to;
        AppointmentService.requireRange(f, t);
        return blocks.ofBusiness(w.businessId(), f, t).stream().map(BlockService::toResponse).toList();
    }

    @Transactional
    public BlockResponse create(BlockInput in) {
        Workspace w = workspace();
        members.findById(in.staffId()).filter(m -> m.getBusinessId().equals(w.businessId()) && m.isActive())
                .orElseThrow(() -> BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "staffId",
                        "Not an active member of this business"));
        AppointmentService.requireFits(in.start(), in.durationMin());
        CalendarBlock b = new CalendarBlock();
        b.setBusinessId(w.businessId());
        b.setStaffId(in.staffId());
        b.setDate(in.date());
        b.setStart(in.start());
        b.setDurationMin(in.durationMin());
        b.setReason(in.reason());
        b = blocks.saveAndFlush(b);
        changed(b);
        return toResponse(b);
    }

    @Transactional
    public void delete(UUID id) {
        Workspace w = workspace();
        CalendarBlock b = blocks.findByIdAndBusinessId(id, w.businessId())
                .orElseThrow(() -> new BusinessException(StatusCode.NOT_FOUND));
        blocks.delete(b);
        changed(b);
    }

    private void changed(CalendarBlock b) {
        events.publishEvent(StreamEvent.toBusiness(b.getBusinessId(), "block",
                java.util.Map.of("id", b.getId().toString(), "date", b.getDate().toString())));
    }

    private Workspace workspace() {
        Workspace w = access.member();
        WorkspaceAccess.requireType(w, BusinessType.SERVICE);
        return w;
    }

    static BlockResponse toResponse(CalendarBlock b) {
        return new BlockResponse(b.getId().toString(), b.getBusinessId().toString(), b.getStaffId().toString(),
                b.getDate().toString(), b.getStart(), b.getDurationMin(), b.getReason());
    }
}
