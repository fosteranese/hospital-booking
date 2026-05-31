CREATE TABLE IF NOT EXISTS users (
    identifier TEXT PRIMARY KEY,
    role TEXT NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'doctor', 'scheduler', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
