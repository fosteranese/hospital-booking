ALTER TABLE doctor_unavailability ADD COLUMN end_date DATE;
UPDATE doctor_unavailability SET end_date = slot_date WHERE end_date IS NULL;
ALTER TABLE doctor_unavailability ALTER COLUMN end_date SET NOT NULL;
