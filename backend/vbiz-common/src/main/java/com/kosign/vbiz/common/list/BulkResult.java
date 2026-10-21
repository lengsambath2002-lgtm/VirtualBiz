package com.kosign.vbiz.common.list;

import java.util.List;

/** What a bulk action on a list did: each row is its own step, so one refusal doesn't stop the rest. */
public record BulkResult(int done, List<Failure> failed) {

    public record Failure(String id, String code, String message) {
    }
}
