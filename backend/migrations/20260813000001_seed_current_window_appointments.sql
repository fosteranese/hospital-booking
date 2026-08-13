-- Seed appointments spanning last 30 days, yesterday, today, tomorrow, and
-- next 30 days (relative to CURRENT_DATE at migration time) for the 5
-- existing test patients (Alice/Bob/Carol/David/Eve, from
-- 20260605000001_seed_test_appointments.sql). The earlier seed migrations
-- froze their dates to whatever "today" was when they first ran
-- (2026-05-xx / 2026-06-11) and are now stale relative to the current date
-- -- this one is written the same CURRENT_DATE-relative way
-- (20260611000001_seed_today_appointments.sql's pattern) so it lands
-- correctly whenever it actually runs.
--
-- Idempotent: skips entirely if this window's data already exists.
--
-- Mix, by bucket:
--   last 30 days: attended (on time / late), missed, and cancelled outcomes
--   yesterday:    guaranteed non-empty, same past mix
--   today:        confirmed, attended still NULL (pending) -- for testing
--                 attendance-marking UI against genuinely "today" data
--   tomorrow:     guaranteed non-empty, confirmed/upcoming
--   next 30 days: confirmed/upcoming, spread out, capped at
--                 max_upcoming_appointments (3) per patient so the
--                 "Upcoming appointments" dashboard view stays realistic
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
    today CONSTANT DATE := CURRENT_DATE;
BEGIN
    IF EXISTS (SELECT 1 FROM appointments WHERE notes = 'seed window') THEN
        RETURN;
    END IF;

    -- Slots across the whole [-30, +30] window, four times a day per
    -- doctor. ON CONFLICT DO NOTHING so this never clobbers slots that
    -- already exist from real bookings (the +7..+27 stretch normally does,
    -- since min_advance_days=7 is exactly what real traffic can reach).
    INSERT INTO availability_slots (doctor_id, slot_date, start_time, end_time)
    SELECT d.id, today + gs.day_offset, t.start_time, t.start_time + INTERVAL '30 minutes'
    FROM (VALUES (doc1), (doc2), (doc3), (doc4)) AS d(id)
    CROSS JOIN generate_series(-30, 30) AS gs(day_offset)
    CROSS JOIN (VALUES (TIME '09:00'), (TIME '10:30'), (TIME '14:00'), (TIME '15:30')) AS t(start_time)
    ON CONFLICT (doctor_id, slot_date, start_time) DO NOTHING;

    -- (patient, doctor, day_offset, start_time, attended, status, minutes_late, note)
    -- Past 30 days + yesterday: a spread of attended/missed/cancelled outcomes.
    CREATE TEMP TABLE seed_rows (
        pat UUID, doc UUID, day_offset INT, start_time TIME,
        attended BOOLEAN, status VARCHAR(20), minutes_late INT, note TEXT
    ) ON COMMIT DROP;

    INSERT INTO seed_rows VALUES
        (pat1, doc1, -28, '09:00', true,  'completed', 0,    'seed window - routine checkup'),
        (pat2, doc2, -25, '10:30', true,  'completed', 12,   'seed window - cardiac follow-up'),
        (pat3, doc3, -23, '14:00', false, 'completed', NULL, 'seed window - missed'),
        (pat4, doc4, -21, '15:30', true,  'completed', 0,    'seed window - child vaccination'),
        (pat5, doc1, -19, '09:00', NULL,  'cancelled', NULL, 'seed window - patient rescheduled'),
        (pat1, doc2, -17, '10:30', true,  'completed', 5,    'seed window - ECG review'),
        (pat2, doc3, -14, '14:00', true,  'completed', 0,    'seed window - skin check'),
        (pat3, doc4, -12, '15:30', false, 'completed', NULL, 'seed window - missed'),
        (pat4, doc1, -9,  '09:00', true,  'completed', 20,   'seed window - follow-up consultation'),
        (pat5, doc2, -6,  '10:30', true,  'completed', 0,    'seed window - blood pressure check'),
        (pat1, doc3, -4,  '14:00', NULL,  'cancelled', NULL, 'seed window - clinic rescheduled'),
        (pat2, doc4, -2,  '15:30', true,  'completed', 8,    'seed window - growth check'),
        -- Yesterday, explicitly non-empty per the request.
        (pat3, doc1, -1,  '09:00', true,  'completed', 0,    'seed window - routine checkup'),
        (pat4, doc2, -1,  '14:00', false, 'completed', NULL, 'seed window - missed'),
        -- Today: pending, attendance not yet recorded.
        (pat5, doc1, 0,   '09:00', NULL,  'confirmed', NULL, 'seed window - routine checkup'),
        (pat1, doc2, 0,   '10:30', NULL,  'confirmed', NULL, 'seed window - cardiac evaluation'),
        (pat2, doc3, 0,   '14:00', NULL,  'confirmed', NULL, 'seed window - mole screening'),
        (pat3, doc4, 0,   '15:30', NULL,  'confirmed', NULL, 'seed window - nutrition advice'),
        -- Tomorrow, explicitly non-empty per the request.
        (pat4, doc1, 1,   '09:00', NULL,  'confirmed', NULL, 'seed window - follow-up'),
        (pat5, doc3, 1,   '14:00', NULL,  'confirmed', NULL, 'seed window - acne treatment'),
        -- Rest of the next 30 days, spread out, capped at 3 upcoming per
        -- patient in total (today/tomorrow rows above already count toward
        -- each patient's cap).
        (pat1, doc4, 6,   '15:30', NULL,  'confirmed', NULL, 'seed window - nutrition follow-up'),
        (pat2, doc1, 10,  '09:00', NULL,  'confirmed', NULL, 'seed window - routine checkup'),
        (pat3, doc2, 15,  '10:30', NULL,  'confirmed', NULL, 'seed window - medication review'),
        (pat4, doc3, 18,  '14:00', NULL,  'confirmed', NULL, 'seed window - rash consultation'),
        (pat5, doc4, 22,  '15:30', NULL,  'confirmed', NULL, 'seed window - fever consultation'),
        (pat1, doc1, 27,  '09:00', NULL,  'confirmed', NULL, 'seed window - annual physical');

    INSERT INTO appointments (patient_id, doctor_id, slot_id, attended, status, minutes_late, notes)
    SELECT r.pat, r.doc, s.id, r.attended, r.status, r.minutes_late, r.note
    FROM seed_rows r
    JOIN availability_slots s
        ON s.doctor_id = r.doc AND s.slot_date = today + r.day_offset AND s.start_time = r.start_time;

    -- Mark slots booked for everything except cancelled appointments,
    -- matching the real cancel endpoint's own behavior (frees the slot).
    UPDATE availability_slots SET is_booked = TRUE
    WHERE id IN (
        SELECT s.id FROM seed_rows r
        JOIN availability_slots s ON s.doctor_id = r.doc AND s.slot_date = today + r.day_offset AND s.start_time = r.start_time
        WHERE r.status != 'cancelled'
    );
END $$;
