package com.kosign.vbiz.auth.payload;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * {@code POST /api/auth/firebase}: the ID token from Firebase Authentication, and the name typed at
 * sign-up (a new email + password account; Google gives its own).
 */
public record FirebaseSignInRequest(@NotBlank @Size(max = 4096) String idToken, @Size(max = 80) String name) {
}
