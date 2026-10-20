package com.kosign.vbiz.admin.payload;

import java.util.List;

/** New one-time recovery codes: shown once, only their hashes are kept. */
public record RecoveryCodesResponse(List<String> codes) {
}
