package com.kosign.vbiz.pos.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kosign.vbiz.pos.domain.PosCashMove;

public interface PosCashMoveRepository extends JpaRepository<PosCashMove, UUID> {

    List<PosCashMove> findByShiftIdInOrderByAtAsc(Collection<UUID> shiftIds);
}
