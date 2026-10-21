package com.kosign.vbiz.report.service;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.security.CurrentUser;
import com.kosign.vbiz.report.domain.SavedView;
import com.kosign.vbiz.report.payload.SavedViewInput;
import com.kosign.vbiz.report.payload.SavedViewResponse;
import com.kosign.vbiz.report.repository.SavedViewRepository;

import lombok.RequiredArgsConstructor;

/**
 * Saved views (docs/api/phase17-more-lists.md): each person keeps up to 20 named filter sets per
 * list. Saving under an existing name replaces it. Only the list's own query string is kept; it is
 * applied as URL parameters, so a view never carries more access than the list already has.
 */
@Service
@RequiredArgsConstructor
public class SavedViewService {

    public static final int MAX_PER_LIST = 20;

    private final SavedViewRepository views;

    @Transactional(readOnly = true)
    public List<SavedViewResponse> list(String listKey) {
        return views.findByUserIdAndListKeyOrderByNameAsc(CurrentUser.id(), listKey).stream()
                .map(SavedViewService::toResponse).toList();
    }

    @Transactional
    public SavedViewResponse save(SavedViewInput in) {
        UUID me = CurrentUser.id();
        String name = in.name().trim().replaceAll("\\s+", " ");
        String query = clean(in.query());
        SavedView v = views.findByUserIdAndListKeyAndNameIgnoreCase(me, in.list(), name).orElse(null);
        if (v == null) {
            if (views.countByUserIdAndListKey(me, in.list()) >= MAX_PER_LIST) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "name",
                        "At most " + MAX_PER_LIST + " views per list");
            }
            v = new SavedView();
            v.setUserId(me);
            v.setListKey(in.list());
        }
        v.setName(name);
        v.setQuery(query);
        return toResponse(views.saveAndFlush(v));
    }

    @Transactional
    public void delete(UUID id) {
        SavedView v = views.findById(id).filter(x -> x.getUserId().equals(CurrentUser.id()))
                .orElseThrow(() -> new BusinessException(StatusCode.NOT_FOUND));
        views.delete(v);
    }

    /** The query without paging (a view opens on its first page) and without a leading "?". */
    static String clean(String raw) {
        if (raw == null) {
            return "";
        }
        String q = raw.startsWith("?") ? raw.substring(1) : raw;
        return String.join("&", java.util.Arrays.stream(q.split("&"))
                .filter(p -> !p.isBlank() && !p.startsWith("page=")).toList());
    }

    private static SavedViewResponse toResponse(SavedView v) {
        return new SavedViewResponse(v.getId().toString(), v.getListKey(), v.getName(), v.getQuery());
    }
}
