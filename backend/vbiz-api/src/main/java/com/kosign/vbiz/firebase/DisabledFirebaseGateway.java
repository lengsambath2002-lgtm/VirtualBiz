package com.kosign.vbiz.firebase;

import java.util.List;

import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;

/** No Firebase project configured: Firebase sign-in answers NOT_CONFIGURED, push does nothing. */
public class DisabledFirebaseGateway implements FirebaseGateway {

    @Override
    public boolean enabled() {
        return false;
    }

    @Override
    public FirebaseIdentity verify(String idToken) {
        throw new BusinessException(StatusCode.NOT_CONFIGURED);
    }

    @Override
    public String ensurePasswordUser(String email, String password, String name) {
        throw new BusinessException(StatusCode.NOT_CONFIGURED);
    }

    @Override
    public void setPassword(String uid, String password) {
        // nothing to keep in step
    }

    @Override
    public List<String> push(List<String> tokens, String title, String body, String link) {
        return List.of();
    }
}
