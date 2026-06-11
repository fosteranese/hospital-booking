-- Seed 30 appointments for today (2026-06-11)
-- Creates slots for today (if not exists), then inserts appointments.
-- Idempotent: skips if today appointments already exist.

DO $$
DECLARE
    doc1 CONSTANT UUID := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'; -- John Smith (GP)
    doc2 CONSTANT UUID := 'b2c3d4e5-f6a7-8901-bcde-f12345678901'; -- Sarah Johnson (Cardiologist)
    doc3 CONSTANT UUID := 'c3d4e5f6-a7b8-9012-cdef-123456789012'; -- Michael Williams (Dermatologist)
    doc4 CONSTANT UUID := 'd4e5f6a7-b8c9-0123-defa-234567890123'; -- Emily Brown (Pediatrician)
    pat1 CONSTANT UUID := '00000000-0000-0000-0000-000000000001'; -- Alice Johnson
    pat2 CONSTANT UUID := '00000000-0000-0000-0000-000000000002'; -- Bob Smith
    pat3 CONSTANT UUID := '00000000-0000-0000-0000-000000000003'; -- Carol Williams
    pat4 CONSTANT UUID := '00000000-0000-0000-0000-000000000004'; -- David Brown
    pat5 CONSTANT UUID := '00000000-0000-0000-0000-000000000005'; -- Eve Davis
    today DATE := CURRENT_DATE;
    slot_ids UUID[];
    doc_ids UUID[];
    pat_ids UUID[];
    idx INT;
    doc_idx INT;
    pat_idx INT;
    slot_count INT;
BEGIN
    -- Skip if we already seeded today
    IF EXISTS (SELECT 1 FROM appointments a JOIN availability_slots s ON a.slot_id = s.id WHERE s.slot_date = today AND a.notes = 'seed today') THEN
        RETURN;
    END IF;

    -- Create 30-min slots for today for all 4 doctors (09:00-16:30)
    INSERT INTO availability_slots (doctor_id, slot_date, start_time, end_time)
    SELECT d.id, today, t.start_time, t.start_time + INTERVAL '30 minutes'
    FROM (VALUES (doc1), (doc2), (doc3), (doc4)) AS d(id)
    CROSS JOIN (
        SELECT TIME '09:00' + INTERVAL '30 minutes' * gs AS start_time
        FROM generate_series(0, 15) AS gs
    ) t
    ON CONFLICT (doctor_id, slot_date, start_time) DO NOTHING;

    -- Doctor IDs array (for cycling)
    doc_ids := ARRAY[doc1, doc2, doc3, doc4];

    -- 30 appointments: 8 for doc1, 8 for doc2, 7 for doc3, 7 for doc4
    -- Slot offsets (0-15 = 09:00-16:30):
    -- doc1: 0,2,4,6,8,10,12,14  (8 slots)
    -- doc2: 1,3,5,7,9,11,13,15  (8 slots)
    -- doc3: 0,3,6,9,12,15,2      (7 slots)
    -- doc4: 4,7,10,13,1,8,11     (7 slots)

    -- Doctor 1: 8 appointments
    FOREACH idx IN ARRAY ARRAY[0,2,4,6,8,10,12,14] LOOP
        pat_idx := (idx / 2) % 5 + 1;
        INSERT INTO appointments (patient_id, doctor_id, slot_id, attended, minutes_late, status, notes)
        SELECT
            (ARRAY[pat1, pat2, pat3, pat4, pat5])[pat_idx],
            doc1,
            id,
            NULL, NULL, 'confirmed',
            CASE WHEN pat_idx = 1 THEN 'seed today - routine checkup'
                 WHEN pat_idx = 2 THEN 'seed today - follow up'
                 WHEN pat_idx = 3 THEN 'seed today - consultation'
                 WHEN pat_idx = 4 THEN 'seed today - test results'
                 ELSE 'seed today' END
        FROM availability_slots
        WHERE doctor_id = doc1 AND slot_date = today
        AND start_time = TIME '09:00' + INTERVAL '30 minutes' * idx;
    END LOOP;

    -- Doctor 2: 8 appointments
    FOREACH idx IN ARRAY ARRAY[1,3,5,7,9,11,13,15] LOOP
        pat_idx := (idx / 3) % 5 + 1;
        INSERT INTO appointments (patient_id, doctor_id, slot_id, attended, minutes_late, status, notes)
        SELECT
            (ARRAY[pat5, pat4, pat3, pat2, pat1])[pat_idx],
            doc2,
            id,
            NULL, NULL, 'confirmed',
            CASE WHEN pat_idx = 1 THEN 'seed today - cardiac evaluation'
                 WHEN pat_idx = 2 THEN 'seed today - ECG review'
                 WHEN pat_idx = 3 THEN 'seed today - blood pressure check'
                 WHEN pat_idx = 4 THEN 'seed today - medication review'
                 ELSE 'seed today' END
        FROM availability_slots
        WHERE doctor_id = doc2 AND slot_date = today
        AND start_time = TIME '09:00' + INTERVAL '30 minutes' * idx;
    END LOOP;

    -- Doctor 3: 7 appointments
    FOREACH idx IN ARRAY ARRAY[0,3,6,9,12,15,2] LOOP
        pat_idx := (idx + 2) % 5 + 1;
        INSERT INTO appointments (patient_id, doctor_id, slot_id, attended, minutes_late, status, notes)
        SELECT
            (ARRAY[pat2, pat4, pat1, pat5, pat3])[pat_idx],
            doc3,
            id,
            NULL, NULL, 'confirmed',
            CASE WHEN pat_idx = 1 THEN 'seed today - skin check'
                 WHEN pat_idx = 2 THEN 'seed today - rash consultation'
                 WHEN pat_idx = 3 THEN 'seed today - mole screening'
                 WHEN pat_idx = 4 THEN 'seed today - acne treatment'
                 ELSE 'seed today' END
        FROM availability_slots
        WHERE doctor_id = doc3 AND slot_date = today
        AND start_time = TIME '09:00' + INTERVAL '30 minutes' * idx;
    END LOOP;

    -- Doctor 4: 7 appointments
    FOREACH idx IN ARRAY ARRAY[4,7,10,13,1,8,11] LOOP
        pat_idx := (idx + 1) % 5 + 1;
        INSERT INTO appointments (patient_id, doctor_id, slot_id, attended, minutes_late, status, notes)
        SELECT
            (ARRAY[pat3, pat1, pat5, pat2, pat4])[pat_idx],
            doc4,
            id,
            NULL, NULL, 'confirmed',
            CASE WHEN pat_idx = 1 THEN 'seed today - child vaccination'
                 WHEN pat_idx = 2 THEN 'seed today - growth check'
                 WHEN pat_idx = 3 THEN 'seed today - fever consultation'
                 WHEN pat_idx = 4 THEN 'seed today - nutrition advice'
                 ELSE 'seed today' END
        FROM availability_slots
        WHERE doctor_id = doc4 AND slot_date = today
        AND start_time = TIME '09:00' + INTERVAL '30 minutes' * idx;
    END LOOP;

    -- Mark booked slots
    UPDATE availability_slots SET is_booked = TRUE
    WHERE slot_date = today AND id IN (
        SELECT slot_id FROM appointments a
        JOIN availability_slots s ON a.slot_id = s.id
        WHERE s.slot_date = today AND a.notes LIKE 'seed today%'
    );
END $$;
