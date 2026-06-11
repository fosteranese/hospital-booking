DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'appointments' AND column_name = 'arrival_time'
    ) THEN
        ALTER TABLE appointments ADD COLUMN arrival_time TIMESTAMPTZ DEFAULT NULL;
    END IF;
END $$;
