package com.kosign.vbiz.report.domain;

import java.util.UUID;

import com.kosign.vbiz.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A person's named filter set for one list ("Unpaid this week"), the list's URL query. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "saved_view")
public class SavedView extends BaseEntity {

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "list_key", length = 40, nullable = false, updatable = false)
    private String listKey;

    @Column(name = "name", length = 60, nullable = false)
    private String name;

    @Column(name = "query", length = 1000, nullable = false)
    private String query;
}
