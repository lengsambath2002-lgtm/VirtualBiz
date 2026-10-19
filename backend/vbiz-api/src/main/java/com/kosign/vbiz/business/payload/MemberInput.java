package com.kosign.vbiz.business.payload;

import com.fasterxml.jackson.databind.JsonNode;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * {@code POST /api/businesses/{id}/members} (name required) and {@code PATCH …/members/{memberId}}
 * (only the fields present change; an empty {@code title} clears it). {@code shifts}: 7 days,
 * Monday first, {@code [startMin, endMin]} or null; JSON null = works the shop's hours.
 */
public record MemberInput(
        @Size(max = 80) String name,
        @Size(max = 80) String title,
        @Pattern(regexp = "^#[0-9A-Fa-f]{6}$") String color,
        JsonNode shifts,
        Boolean active) {
}
