CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_otp_codes_expires_at
ON otp_codes(expires_at);
