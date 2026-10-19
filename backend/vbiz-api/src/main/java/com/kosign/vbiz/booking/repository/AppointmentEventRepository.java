package com.kosign.vbiz.booking.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kosign.vbiz.booking.domain.AppointmentEvent;

public interface AppointmentEventRepository extends JpaRepository<AppointmentEvent, UUID> {

    List<AppointmentEvent> findByAppointmentIdInOrderByAtAscCreatedAtAsc(Collection<UUID> appointmentIds);

    Optional<AppointmentEvent> findFirstByAppointmentIdOrderByAtDescCreatedAtDesc(UUID appointmentId);
}
