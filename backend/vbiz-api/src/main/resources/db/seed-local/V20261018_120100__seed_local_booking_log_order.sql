-- Local seed fix: today's demo appointments were "booked" a fixed number of minutes before the
-- seed ran, which on a late run falls after the visit (the log then shows "Paid" before
-- "Booked"). A booking is made before its visit: at least an hour before it starts.
UPDATE appointment_event e
SET at = LEAST(e.at, (a.date + make_interval(mins => a.start_min))::timestamp AT TIME ZONE 'Asia/Phnom_Penh'
                     - interval '1 hour')
FROM appointment a
WHERE e.appointment_id = a.id AND e.code IN ('bookedOnline', 'bookedPhone', 'bookedWalkin');

UPDATE appointment a
SET created_at = LEAST(a.created_at, (a.date + make_interval(mins => a.start_min))::timestamp AT TIME ZONE 'Asia/Phnom_Penh'
                                     - interval '1 hour')
WHERE a.source <> 'WALK_IN' OR a.created_at > (a.date + make_interval(mins => a.start_min))::timestamp AT TIME ZONE 'Asia/Phnom_Penh';
