-- Seed dev users with all MFA methods and phone numbers
UPDATE users SET
  mfa_methods = 'email,phone,authenticator',
  phone = CASE identifier
    WHEN 'admin@hospital.com' THEN '+233501234567'
    WHEN 'doctor@hospital.com' THEN '+233501234568'
    WHEN 'scheduler@hospital.com' THEN '+233501234569'
  END
WHERE identifier IN ('admin@hospital.com', 'doctor@hospital.com', 'scheduler@hospital.com');
