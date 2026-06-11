-- Performance indexes for frequently queried columns

-- appointments.slot_id is joined to availability_slots in virtually every query
CREATE INDEX IF NOT EXISTS idx_appointments_slot ON appointments(slot_id);

-- appointments.status is filtered in almost every query (status = 'confirmed', status != 'cancelled')
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- Composite index for the common filter pattern: doctor_id + status + date range
-- This avoids joining to availability_slots before filtering by date
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_status_date ON appointments(doctor_id, status, slot_id);

-- availability_slots slot_date for date range queries and ordering
CREATE INDEX IF NOT EXISTS idx_availability_slots_date ON availability_slots(slot_date);

-- Partial index for the common NOT is_booked filter
CREATE INDEX IF NOT EXISTS idx_availability_slots_available ON availability_slots(doctor_id, slot_date, start_time)
  WHERE NOT is_booked;

-- Composite index for conflict detection range queries
-- The unavailability queries use s.slot_date BETWEEN du.slot_date AND du.end_date
CREATE INDEX IF NOT EXISTS idx_unavailability_dates ON doctor_unavailability(doctor_id, slot_date, end_date);
