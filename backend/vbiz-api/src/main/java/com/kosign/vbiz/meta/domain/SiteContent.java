package com.kosign.vbiz.meta.domain;

import java.time.Instant;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A document a super-admin edits in the console: the homepage banners or a legal page
 * ({@link #HOME_BANNERS}, {@link #TERMS}, {@link #PRIVACY}). The JSON body is checked by
 * {@code SiteContentService}; each change is audited.
 */
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "site_content")
public class SiteContent {

    public static final String HOME_BANNERS = "home-banners";
    public static final String TERMS = "terms";
    public static final String PRIVACY = "privacy";

    @Id
    @Column(name = "key", length = 40, nullable = false, updatable = false)
    private String key;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "body", nullable = false)
    private String body;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "updated_by", length = 80)
    private String updatedBy;
}
