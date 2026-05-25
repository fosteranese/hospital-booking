-- Replace UNIQUE constraints on phone/email with partial unique indexes
-- that only enforce uniqueness for non-empty values.
-- This allows multiple patients with empty optional phone/email.

ALTER TABLE patients DROP CONSTRAINT patients_phone_key;
ALTER TABLE patients DROP CONSTRAINT patients_email_key;

CREATE UNIQUE INDEX patients_phone_unique ON patients(phone) WHERE phone != '';
CREATE UNIQUE INDEX patients_email_unique ON patients(email) WHERE email != '';
