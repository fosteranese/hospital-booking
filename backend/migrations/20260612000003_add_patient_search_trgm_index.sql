CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_patients_first_name_trgm
ON patients USING GIN (LOWER(first_name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_patients_last_name_trgm
ON patients USING GIN (LOWER(last_name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_patients_email_trgm
ON patients USING GIN (LOWER(email) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_patients_phone_trgm
ON patients USING GIN (phone gin_trgm_ops);
