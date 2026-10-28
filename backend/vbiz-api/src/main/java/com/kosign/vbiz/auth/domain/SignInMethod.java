package com.kosign.vbiz.auth.domain;

/** Ways a user can sign in. */
public enum SignInMethod {
    PASSWORD,
    GOOGLE,
    EMAIL_CODE,
    PHONE_SMS,
    /** Single sign-on with the Business Platform (docs/adr/0003-sso-with-the-business-platform.md). */
    PLATFORM
}
