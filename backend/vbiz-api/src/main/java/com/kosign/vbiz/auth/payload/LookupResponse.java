package com.kosign.vbiz.auth.payload;

import java.util.List;

import com.kosign.vbiz.auth.domain.SignInMethod;

/** Whether an account exists for the email, and how it can sign in. */
public record LookupResponse(boolean exists, List<SignInMethod> methods) {
}
