DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'appointments' AND column_name = 'minutes_late'
    ) THEN
        ALTER TABLE appointments ADD COLUMN minutes_late INTEGER DEFAULT NULL;
    END IF;
END $$;
