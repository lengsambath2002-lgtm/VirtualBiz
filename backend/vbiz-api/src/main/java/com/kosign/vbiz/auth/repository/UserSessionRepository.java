package com.kosign.vbiz.auth.repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.kosign.vbiz.auth.domain.UserSession;

import jakarta.persistence.LockModeType;

public interface UserSessionRepository extends JpaRepository<UserSession, UUID> {

    Optional<UserSession> findByTokenHash(String tokenHash);

    /** Row-locks the session so two concurrent refreshes of one token cannot both rotate it. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from UserSession s where s.tokenHash = :tokenHash")
    Optional<UserSession> lockByTokenHash(@Param("tokenHash") String tokenHash);

    /** The access token's session is not revoked and its account is not suspended. */
    @Query(value = """
            SELECT EXISTS (SELECT 1 FROM user_session s JOIN users u ON u.id = s.user_id
                            WHERE s.id = :sessionId AND s.user_id = :userId
                              AND s.revoked_at IS NULL AND u.suspended_at IS NULL)""", nativeQuery = true)
    boolean isLive(@Param("userId") UUID userId, @Param("sessionId") UUID sessionId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update UserSession s set s.revokedAt = :now where s.familyId = :familyId and s.revokedAt is null")
    int revokeFamily(@Param("familyId") UUID familyId, @Param("now") Instant now);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update UserSession s set s.revokedAt = :now where s.userId = :userId and s.revokedAt is null")
    int revokeAllForUser(@Param("userId") UUID userId, @Param("now") Instant now);
}
