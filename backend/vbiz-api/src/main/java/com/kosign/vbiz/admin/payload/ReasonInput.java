package com.kosign.vbiz.admin.payload;

import jakarta.validation.constraints.Size;

/**
 * Body of an admin action. The reason is required where the action affects someone (reject,
 * suspend, cancel, refund, hide): 3–300 characters, shown to them and kept in the audit log.
 */
public record ReasonInput(@Size(max = 300) String reason) {
}
