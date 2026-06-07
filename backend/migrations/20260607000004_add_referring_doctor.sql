ALTER TABLE appointments ADD COLUMN referring_doctor_id UUID REFERENCES doctors(id);
