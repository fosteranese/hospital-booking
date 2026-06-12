CREATE INDEX IF NOT EXISTS idx_appointments_patient_status
ON appointments(patient_id, status);
