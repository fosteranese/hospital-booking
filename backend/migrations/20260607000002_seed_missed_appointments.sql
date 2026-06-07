-- Mark some of today's pending appointments as missed for testing
DO $$
DECLARE
    target_ids UUID[] := ARRAY(SELECT a.id FROM appointments a
        JOIN availability_slots s ON s.id = a.slot_id
        WHERE s.slot_date = CURRENT_DATE
          AND a.attended IS NULL
          AND a.status != 'cancelled'
        LIMIT 3);
    appt_id UUID;
BEGIN
    FOREACH appt_id IN ARRAY target_ids
    LOOP
        UPDATE appointments SET attended = false, minutes_late = 0 WHERE id = appt_id;
    END LOOP;
END $$;
