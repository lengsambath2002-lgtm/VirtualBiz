package com.kosign.vbiz.meta.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kosign.vbiz.meta.domain.SiteContent;

public interface SiteContentRepository extends JpaRepository<SiteContent, String> {
}
