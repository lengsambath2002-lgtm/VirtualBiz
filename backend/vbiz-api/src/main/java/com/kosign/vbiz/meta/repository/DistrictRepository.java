package com.kosign.vbiz.meta.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kosign.vbiz.meta.domain.District;

public interface DistrictRepository extends JpaRepository<District, String> {

    Optional<District> findByNameIgnoreCase(String name);
}
