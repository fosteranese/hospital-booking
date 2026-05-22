-- Generate 30-min slots for each doctor for the next 14 days
INSERT INTO availability_slots (doctor_id, slot_date, start_time, end_time)
SELECT
    d.id,
    s.slot_date,
    s.start_time,
    s.start_time + INTERVAL '30 minutes' AS end_time
FROM doctors d
CROSS JOIN (
    SELECT
        CURRENT_DATE + INTERVAL '1 day' * gs AS slot_date,
        TIME '09:00' + INTERVAL '30 minutes' * gs2 AS start_time
    FROM generate_series(0, 13) AS gs,
         generate_series(0, 15) AS gs2  -- 9:00 to 16:30 (16 slots)
    WHERE TIME '09:00' + INTERVAL '30 minutes' * gs2 < TIME '17:00'
) s
WHERE NOT EXISTS (
    SELECT 1 FROM availability_slots existing
    WHERE existing.doctor_id = d.id
    AND existing.slot_date = s.slot_date
    AND existing.start_time = s.start_time
);
