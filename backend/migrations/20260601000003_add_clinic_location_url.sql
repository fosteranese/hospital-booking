INSERT INTO settings (group_name, name, value, is_sensitive, description, value_type)
VALUES ('clinic', 'clinic_location_url', '', false, 'Google Maps location URL for the clinic', 'url')
ON CONFLICT (group_name, name) DO NOTHING;
