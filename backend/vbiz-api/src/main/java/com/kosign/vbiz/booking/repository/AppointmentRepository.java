package com.kosign.vbiz.booking.repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.kosign.vbiz.booking.domain.Appointment;
import com.kosign.vbiz.booking.domain.AppointmentStatus;

import jakarta.persistence.LockModeType;

public interface AppointmentRepository extends JpaRepository<Appointment, UUID> {

    @Query(value = "select nextval('booking_number_seq')", nativeQuery = true)
    long nextNumber();

    /**
     * Serialises online bookings of one business for the rest of the transaction (two customers
     * cannot both take the last free slot).
     */
    @Query(value = "select count(*) from (select pg_advisory_xact_lock(:key)) l", nativeQuery = true)
    long lockBusiness(@Param("key") long key);

    Optional<Appointment> findByNumber(String number);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Appointment a where a.id = :id")
    Optional<Appointment> lockById(@Param("id") UUID id);

    @Query("""
            select a from Appointment a where a.businessId = :businessId and a.date between :from and :to
            order by a.date asc, a.start asc, a.number asc""")
    List<Appointment> ofBusiness(@Param("businessId") UUID businessId, @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    /** Appointments of these staff members on these days that hold their time. */
    @Query("""
            select a from Appointment a where a.staffId in :staffIds and a.date between :from and :to
              and a.status in :statuses""")
    List<Appointment> holding(@Param("staffIds") Collection<UUID> staffIds, @Param("from") LocalDate from,
            @Param("to") LocalDate to, @Param("statuses") Collection<AppointmentStatus> statuses);

    /** Booked or confirmed visits in these days that haven't had their reminder. */
    @Query("""
            select a from Appointment a where a.remindedAt is null and a.date between :from and :to
            and a.status in (com.kosign.vbiz.booking.domain.AppointmentStatus.BOOKED,
                             com.kosign.vbiz.booking.domain.AppointmentStatus.CONFIRMED)""")
    List<Appointment> dueForReminder(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("select a from Appointment a where a.customerId = :customerId order by a.date desc, a.start desc")
    List<Appointment> ofCustomer(@Param("customerId") UUID customerId);
}
