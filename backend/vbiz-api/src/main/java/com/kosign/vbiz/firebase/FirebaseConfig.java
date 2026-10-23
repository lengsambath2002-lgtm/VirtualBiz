package com.kosign.vbiz.firebase;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;

import lombok.extern.slf4j.Slf4j;

/**
 * Firebase from the service-account file when {@code vbiz.firebase.enabled}; otherwise a gateway that
 * answers NOT_CONFIGURED. With {@code FIREBASE_AUTH_EMULATOR_HOST} set, the Admin SDK talks to the
 * local Auth emulator (tests, docs/ops/firebase.md).
 */
@Slf4j
@Configuration
public class FirebaseConfig {

    @Bean
    public FirebaseGateway firebaseGateway(FirebaseProperties props) throws IOException {
        if (!props.enabled()) {
            return new DisabledFirebaseGateway();
        }
        FirebaseOptions.Builder options = FirebaseOptions.builder();
        if (props.projectId() != null && !props.projectId().isBlank()) {
            options.setProjectId(props.projectId());
        }
        if (props.credentials() != null && !props.credentials().isBlank()) {
            try (InputStream in = new FileInputStream(props.credentials())) {
                options.setCredentials(GoogleCredentials.fromStream(in));
            }
        } else {
            // The emulator needs no key; elsewhere this uses the host's default credentials.
            options.setCredentials(GoogleCredentials.newBuilder().build());
        }
        String name = "vbiz";
        FirebaseApp app = FirebaseApp.getApps().stream().filter(a -> a.getName().equals(name)).findFirst()
                .orElseGet(() -> FirebaseApp.initializeApp(options.build(), name));
        log.info("[FIREBASE] Project {} ready", app.getOptions().getProjectId());
        return new FirebaseAdminGateway(app);
    }
}
