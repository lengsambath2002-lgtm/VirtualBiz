package com.kosign.vbiz.auth.domain;

/** Single-use tickets handed out after a verified code: set a new password, or register a phone. */
public enum TicketKind {
    RESET,
    PHONE
}
