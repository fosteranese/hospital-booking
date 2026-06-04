-- Seed test appointments for trend visibility
-- Creates patients, slots, and appointments for last week, last month, and last year.
-- Idempotent: skips if test patients already exist.

DO $$
DECLARE
    doc_id CONSTANT UUID := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
BEGIN
    IF EXISTS (SELECT 1 FROM patients WHERE phone IN ('+0000000001','+0000000002','+0000000003','+0000000004','+0000000005')) THEN
        RETURN;
    END IF;

    -- Create test patients
    INSERT INTO patients (id, first_name, last_name, phone, email) VALUES
        ('00000000-0000-0000-0000-000000000001', 'Alice', 'Johnson', '+0000000001', 'alice@test.com'),
        ('00000000-0000-0000-0000-000000000002', 'Bob',   'Smith',   '+0000000002', 'bob@test.com'),
        ('00000000-0000-0000-0000-000000000003', 'Carol', 'Williams','+0000000003', 'carol@test.com'),
        ('00000000-0000-0000-0000-000000000004', 'David', 'Brown',   '+0000000004', 'david@test.com'),
        ('00000000-0000-0000-0000-000000000005', 'Eve',   'Davis',   '+0000000005', 'eve@test.com');

    -- Slots for last week (May 25 Mon – May 31 Sun)
    INSERT INTO availability_slots (doctor_id, slot_date, start_time, end_time) VALUES
        (doc_id, '2026-05-25', '09:00', '09:30'),
        (doc_id, '2026-05-25', '09:30', '10:00'),
        (doc_id, '2026-05-25', '10:00', '10:30'),
        (doc_id, '2026-05-27', '09:00', '09:30'),
        (doc_id, '2026-05-27', '09:30', '10:00'),
        (doc_id, '2026-05-29', '10:00', '10:30')
    ON CONFLICT (doctor_id, slot_date, start_time) DO NOTHING;

    -- Extra slots for last month (May 2026) beyond last week
    INSERT INTO availability_slots (doctor_id, slot_date, start_time, end_time) VALUES
        (doc_id, '2026-05-05', '11:00', '11:30'),
        (doc_id, '2026-05-05', '11:30', '12:00'),
        (doc_id, '2026-05-12', '14:00', '14:30'),
        (doc_id, '2026-05-19', '09:00', '09:30')
    ON CONFLICT (doctor_id, slot_date, start_time) DO NOTHING;

    -- Slots for last year (2025)
    INSERT INTO availability_slots (doctor_id, slot_date, start_time, end_time) VALUES
        (doc_id, '2025-01-15', '09:00', '09:30'),
        (doc_id, '2025-01-15', '09:30', '10:00'),
        (doc_id, '2025-03-20', '10:00', '10:30'),
        (doc_id, '2025-06-10', '11:00', '11:30'),
        (doc_id, '2025-09-05', '14:00', '14:30'),
        (doc_id, '2025-11-22', '09:00', '09:30')
    ON CONFLICT (doctor_id, slot_date, start_time) DO NOTHING;

    -- ── Last week appointments (May 25-31) ──

    -- May 25: Alice attended (3 min late), Bob missed, Carol cancelled
    INSERT INTO appointments (patient_id, doctor_id, slot_id, attended, minutes_late, status, notes)
    SELECT '00000000-0000-0000-0000-000000000001', doc_id, id, true, 3,  'completed', 'test data'
    FROM availability_slots WHERE doctor_id=doc_id AND slot_date='2026-05-25' AND start_time='09:00';

    INSERT INTO appointments (patient_id, doctor_id, slot_id, attended, minutes_late, status, notes)
    SELECT '00000000-0000-0000-0000-000000000002', doc_id, id, false, NULL, 'completed', 'test data'
    FROM availability_slots WHERE doctor_id=doc_id AND slot_date='2026-05-25' AND start_time='09:30';

    INSERT INTO appointments (patient_id, doctor_id, slot_id, attended, minutes_late, status, notes)
    SELECT '00000000-0000-0000-0000-000000000003', doc_id, id, NULL, NULL, 'cancelled', 'test data'
    FROM availability_slots WHERE doctor_id=doc_id AND slot_date='2026-05-25' AND start_time='10:00';

    -- May 27: Eve attended (15 min late), Alice attended (on time)
    INSERT INTO appointments (patient_id, doctor_id, slot_id, attended, minutes_late, status, notes)
    SELECT '00000000-0000-0000-0000-000000000005', doc_id, id, true, 15, 'completed', 'test data'
    FROM availability_slots WHERE doctor_id=doc_id AND slot_date='2026-05-27' AND start_time='09:00';

    INSERT INTO appointments (patient_id, doctor_id, slot_id, attended, minutes_late, status, notes)
    SELECT '00000000-0000-0000-0000-000000000001', doc_id, id, true, 0,  'completed', 'test data'
    FROM availability_slots WHERE doctor_id=doc_id AND slot_date='2026-05-27' AND start_time='09:30';

    -- May 29: Bob attended (2 min late)
    INSERT INTO appointments (patient_id, doctor_id, slot_id, attended, minutes_late, status, notes)
    SELECT '00000000-0000-0000-0000-000000000002', doc_id, id, true, 2,  'completed', 'test data'
    FROM availability_slots WHERE doctor_id=doc_id AND slot_date='2026-05-29' AND start_time='10:00';

    -- ── Additional last month appointments (May 2026) ──

    -- May 5: Alice attended (5 min late), Carol missed
    INSERT INTO appointments (patient_id, doctor_id, slot_id, attended, minutes_late, status, notes)
    SELECT '00000000-0000-0000-0000-000000000001', doc_id, id, true, 5,  'completed', 'test data'
    FROM availability_slots WHERE doctor_id=doc_id AND slot_date='2026-05-05' AND start_time='11:00';

    INSERT INTO appointments (patient_id, doctor_id, slot_id, attended, minutes_late, status, notes)
    SELECT '00000000-0000-0000-0000-000000000003', doc_id, id, false, NULL, 'completed', 'test data'
    FROM availability_slots WHERE doctor_id=doc_id AND slot_date='2026-05-05' AND start_time='11:30';

    -- May 12: David attended (on time)
    INSERT INTO appointments (patient_id, doctor_id, slot_id, attended, minutes_late, status, notes)
    SELECT '00000000-0000-0000-0000-000000000004', doc_id, id, true, 0,  'completed', 'test data'
    FROM availability_slots WHERE doctor_id=doc_id AND slot_date='2026-05-12' AND start_time='14:00';

    -- May 19: Bob attended (10 min late)
    INSERT INTO appointments (patient_id, doctor_id, slot_id, attended, minutes_late, status, notes)
    SELECT '00000000-0000-0000-0000-000000000002', doc_id, id, true, 10, 'completed', 'test data'
    FROM availability_slots WHERE doctor_id=doc_id AND slot_date='2026-05-19' AND start_time='09:00';

    -- ── Last year appointments (2025) ──

    -- Jan 15: Alice attended (on time), Bob missed
    INSERT INTO appointments (patient_id, doctor_id, slot_id, attended, minutes_late, status, notes)
    SELECT '00000000-0000-0000-0000-000000000001', doc_id, id, true, 0,  'completed', 'test data'
    FROM availability_slots WHERE doctor_id=doc_id AND slot_date='2025-01-15' AND start_time='09:00';

    INSERT INTO appointments (patient_id, doctor_id, slot_id, attended, minutes_late, status, notes)
    SELECT '00000000-0000-0000-0000-000000000002', doc_id, id, false, NULL, 'completed', 'test data'
    FROM availability_slots WHERE doctor_id=doc_id AND slot_date='2025-01-15' AND start_time='09:30';

    -- Mar 20: Carol attended (8 min late)
    INSERT INTO appointments (patient_id, doctor_id, slot_id, attended, minutes_late, status, notes)
    SELECT '00000000-0000-0000-0000-000000000003', doc_id, id, true, 8,  'completed', 'test data'
    FROM availability_slots WHERE doctor_id=doc_id AND slot_date='2025-03-20' AND start_time='10:00';

    -- Jun 10: David attended (on time)
    INSERT INTO appointments (patient_id, doctor_id, slot_id, attended, minutes_late, status, notes)
    SELECT '00000000-0000-0000-0000-000000000004', doc_id, id, true, 0,  'completed', 'test data'
    FROM availability_slots WHERE doctor_id=doc_id AND slot_date='2025-06-10' AND start_time='11:00';

    -- Sep 5: Eve attended (3 min late)
    INSERT INTO appointments (patient_id, doctor_id, slot_id, attended, minutes_late, status, notes)
    SELECT '00000000-0000-0000-0000-000000000005', doc_id, id, true, 3,  'completed', 'test data'
    FROM availability_slots WHERE doctor_id=doc_id AND slot_date='2025-09-05' AND start_time='14:00';

    -- Nov 22: Alice cancelled
    INSERT INTO appointments (patient_id, doctor_id, slot_id, attended, minutes_late, status, notes)
    SELECT '00000000-0000-0000-0000-000000000001', doc_id, id, NULL, NULL, 'cancelled', 'test data'
    FROM availability_slots WHERE doctor_id=doc_id AND slot_date='2025-11-22' AND start_time='09:00';

END $$;
