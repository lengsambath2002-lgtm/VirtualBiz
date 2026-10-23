package com.kosign.vbiz.notification.push;

import java.time.Instant;
import java.util.UUID;

import com.kosign.vbiz.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/** A browser or phone that gets push notifications for a person (docs/ops/firebase.md). */
@Getter
@Setter
@Entity
@Table(name = "push_token")
public class PushToken extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    /** The Firebase Cloud Messaging registration token. */
    @Column(name = "token", nullable = false, length = 512)
    private String token;

    /** {@code web}, {@code android} or {@code ios}. */
    @Column(name = "platform", nullable = false, length = 16)
    private String platform = "web";

    @Column(name = "last_seen", nullable = false)
    private Instant lastSeen;
}
