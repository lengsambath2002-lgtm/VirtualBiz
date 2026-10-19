package com.kosign.vbiz.customer.payload;

import jakarta.validation.constraints.Size;

/**
 * {@code POST /api/clients} (name and phone required) and {@code PATCH /api/clients/{id}} (only the
 * fields present change; an empty {@code email} or {@code note} clears it).
 */
public record ClientInput(
        @Size(max = 80) String name,
        @Size(max = 20) String phone,
        @Size(max = 254) String email,
        @Size(max = 500) String note) {
}
