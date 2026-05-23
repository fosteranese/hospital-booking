INSERT INTO patients (id, first_name, last_name, phone, email) VALUES
    ('bd337ccf-592f-4b71-a7ab-d5df9418802f', 'Foster', 'Anese', '+2330243505598', 'fosteranese@gmail.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO appointments (patient_id, doctor_id, slot_id, status)
SELECT
    'bd337ccf-592f-4b71-a7ab-d5df9418802f',
    'd4e5f6a7-b8c9-0123-defa-234567890123',
    s.id,
    'confirmed'
FROM availability_slots s
WHERE s.doctor_id = 'd4e5f6a7-b8c9-0123-defa-234567890123'
  AND s.slot_date = '2026-05-21'
  AND s.start_time = '09:00:00'
  AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.slot_id = s.id);

INSERT INTO appointments (patient_id, doctor_id, slot_id, status)
SELECT
    'bd337ccf-592f-4b71-a7ab-d5df9418802f',
    'd4e5f6a7-b8c9-0123-defa-234567890123',
    s.id,
    'confirmed'
FROM availability_slots s
WHERE s.doctor_id = 'd4e5f6a7-b8c9-0123-defa-234567890123'
  AND s.slot_date > CURRENT_DATE
  AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.slot_id = s.id AND a.status = 'confirmed')
ORDER BY s.slot_date, s.start_time
LIMIT 1;
