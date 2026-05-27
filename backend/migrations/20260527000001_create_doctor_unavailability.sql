CREATE TABLE doctor_unavailability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    slot_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    reason TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_doctor_unavail_doctor_date ON doctor_unavailability(doctor_id, slot_date);

-- A full-day off has start_time = NULL and end_time = NULL
-- A time-range off has start_time and end_time set
-- CHECK constraint: both or neither
ALTER TABLE doctor_unavailability ADD CONSTRAINT check_unavail_range
    CHECK ((start_time IS NULL AND end_time IS NULL) OR (start_time IS NOT NULL AND end_time IS NOT NULL));
