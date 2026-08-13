-- Audit finding #3 (follow-up UX comparison): no appointment reminder
-- mechanism existed anywhere in the system -- only a booking-time
-- confirmation email. This flag lets the new reminder sweep
-- (services/reminders.rs) mark an appointment as handled so it's never
-- reminded twice, the same pattern minutes_late/attended already use.
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT FALSE;
