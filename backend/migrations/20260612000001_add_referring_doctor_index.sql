CREATE INDEX IF NOT EXISTS idx_appointments_referring_doctor
ON appointments(referring_doctor_id);
