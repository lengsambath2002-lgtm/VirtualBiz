package com.kosign.vbiz.booking.service;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

import com.kosign.vbiz.booking.payload.AppointmentInputs;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.list.BulkResult;

import lombok.RequiredArgsConstructor;

/**
 * One status change for many appointments, e.g. accepting every waiting request
 * (docs/api/phase16-shop-lists.md). Each goes through {@link AppointmentService#setStatus} in its own
 * transaction, with its rules, clash check and notifications; a refused one is reported.
 */
@Service
@RequiredArgsConstructor
public class BookingBulkService {

    public static final int MAX = 100;

    private final AppointmentService appointments;

    public BulkResult setStatus(List<String> refs, AppointmentInputs.Status in) {
        int done = 0;
        List<BulkResult.Failure> failed = new ArrayList<>();
        for (String ref : refs.stream().distinct().limit(MAX).toList()) {
            try {
                appointments.setStatus(ref, in);
                done++;
            } catch (BusinessException e) {
                failed.add(new BulkResult.Failure(ref, e.getStatusCode().name(), e.getMessage()));
            }
        }
        return new BulkResult(done, failed);
    }
}
