package com.kosign.vbiz.meta.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kosign.vbiz.meta.domain.PlatformSettings;

public interface PlatformSettingsRepository extends JpaRepository<PlatformSettings, Short> {
}
