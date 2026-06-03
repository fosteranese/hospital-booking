use std::sync::Arc;

use aes_gcm::{
    Aes256Gcm, Key, KeyInit, Nonce,
    aead::Aead,
};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use rand::Rng;
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;

#[derive(Debug, sqlx::FromRow, Serialize)]
pub struct Setting {
    pub id: Uuid,
    pub group_name: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
    pub is_sensitive: bool,
    pub description: String,
    pub value_type: String,
}

#[derive(Clone)]
pub struct SettingsService {
    pool: PgPool,
    cipher: Arc<Aes256Gcm>,
}

impl SettingsService {
    pub fn new(pool: PgPool, encryption_key_hex: &str) -> Result<Self, AppError> {
        let key_bytes = hex::decode(encryption_key_hex)
            .map_err(|_| AppError::Internal("Invalid SETTINGS_ENCRYPTION_KEY: must be hex-encoded 32 bytes".into()))?;
        let key_array: [u8; 32] = key_bytes
            .try_into()
            .map_err(|_| AppError::Internal("SETTINGS_ENCRYPTION_KEY must be exactly 32 bytes (64 hex chars)".into()))?;
        let key = Key::<Aes256Gcm>::from_slice(&key_array);
        let cipher = Aes256Gcm::new(key);
        Ok(Self { pool, cipher: Arc::new(cipher) })
    }

    pub async fn seed_defaults(&self) -> Result<(), AppError> {
        let defaults: Vec<(&str, &str, &str, bool, &str, &str)> = vec![
            ("smtp", "host", "smtp.example.com", false, "SMTP server hostname", "text"),
            ("smtp", "port", "587", false, "SMTP server port", "integer"),
            ("smtp", "user", "noreply@hospital.com", true, "SMTP username", "email"),
            ("smtp", "pass", "your-smtp-password", true, "SMTP password", "password"),
            ("smtp", "from_email", "noreply@hospital.com", false, "Sender email address for outgoing emails", "email"),
            ("appointment", "min_gap_minutes", "180", false, "Minimum gap in minutes between same patient's appointments", "integer"),
            ("appointment", "slot_duration_minutes", "30", false, "Duration of each appointment time slot in minutes", "integer"),
            ("appointment", "monday_start", "09:00", false, "Monday first slot (HH:MM, empty=closed)", "time"),
            ("appointment", "monday_end", "17:00", false, "Monday last slot end (HH:MM)", "time"),
            ("appointment", "tuesday_start", "09:00", false, "Tuesday first slot (HH:MM, empty=closed)", "time"),
            ("appointment", "tuesday_end", "17:00", false, "Tuesday last slot end (HH:MM)", "time"),
            ("appointment", "wednesday_start", "09:00", false, "Wednesday first slot (HH:MM, empty=closed)", "time"),
            ("appointment", "wednesday_end", "17:00", false, "Wednesday last slot end (HH:MM)", "time"),
            ("appointment", "thursday_start", "09:00", false, "Thursday first slot (HH:MM, empty=closed)", "time"),
            ("appointment", "thursday_end", "17:00", false, "Thursday last slot end (HH:MM)", "time"),
            ("appointment", "friday_start", "09:00", false, "Friday first slot (HH:MM, empty=closed)", "time"),
            ("appointment", "friday_end", "17:00", false, "Friday last slot end (HH:MM)", "time"),
            ("appointment", "saturday_start", "", false, "Saturday first slot (HH:MM, empty=closed)", "time"),
            ("appointment", "saturday_end", "", false, "Saturday last slot end (HH:MM)", "time"),
            ("appointment", "sunday_start", "", false, "Sunday first slot (HH:MM, empty=closed)", "time"),
            ("appointment", "sunday_end", "", false, "Sunday last slot end (HH:MM)", "time"),
            ("appointment", "slot_days_ahead", "14", false, "Number of days ahead to generate slots", "integer"),
            ("appointment", "min_advance_days", "7", false, "Minimum number of days in advance required when booking an appointment", "integer"),
            ("clinic", "clinic_name", "MEDIPORT FERTILITY SERVICES", false, "Clinic name displayed in emails and UI", "text"),
            ("clinic", "clinic_address", "Bissau Avenue, East-Legon, Accra, Ghana", false, "Clinic address line displayed in UI", "address"),
            ("clinic", "clinic_location_url", "", false, "Google Maps location URL for the clinic", "url"),
            ("appointment", "max_upcoming_appointments", "3", false, "Maximum number of upcoming appointments a patient can have at a time", "integer"),
            ("otp", "length", "6", false, "OTP code length (number of digits)", "integer"),
        ];

        for (group, name, default_value, sensitive, description, value_type) in defaults {
            let value = if sensitive {
                self.encrypt(default_value)
            } else {
                default_value.to_string()
            };

            sqlx::query(
                "INSERT INTO settings (group_name, name, value, is_sensitive, description, value_type)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (group_name, name) DO UPDATE SET
                   value = CASE WHEN settings.is_sensitive THEN settings.value ELSE EXCLUDED.value END,
                   description = EXCLUDED.description,
                   value_type = EXCLUDED.value_type"
            )
            .bind(group)
            .bind(name)
            .bind(&value)
            .bind(sensitive)
            .bind(description)
            .bind(value_type)
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::Database(e))?;
        }

        Ok(())
    }

    pub async fn get(&self, group: &str, name: &str) -> Result<Option<String>, AppError> {
        let row = sqlx::query_as::<_, Setting>(
            "SELECT id, group_name, name, value, is_sensitive, description, value_type FROM settings WHERE group_name = $1 AND name = $2"
        )
        .bind(group)
        .bind(name)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| AppError::Database(e))?;

        match row {
            Some(s) if s.is_sensitive => {
                let decrypted = self.decrypt(&s.value.unwrap_or_default())?;
                Ok(Some(decrypted))
            }
            Some(s) => Ok(s.value),
            None => Ok(None),
        }
    }

    pub async fn get_setting(&self, group: &str, name: &str) -> Result<Option<Setting>, AppError> {
        let mut row = sqlx::query_as::<_, Setting>(
            "SELECT id, group_name, name, value, is_sensitive, description, value_type FROM settings WHERE group_name = $1 AND name = $2"
        )
        .bind(group)
        .bind(name)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| AppError::Database(e))?;

        if let Some(ref mut s) = row {
            if s.is_sensitive {
                s.value = Some(self.decrypt(&s.value.clone().unwrap_or_default())?);
            }
        }
        Ok(row)
    }

    pub async fn get_group(&self, group: &str) -> Result<Vec<Setting>, AppError> {
        let rows = sqlx::query_as::<_, Setting>(
            "SELECT id, group_name, name, value, is_sensitive, description, value_type FROM settings WHERE group_name = $1 ORDER BY name"
        )
        .bind(group)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Database(e))?;

        let mut decrypted = Vec::with_capacity(rows.len());
        for mut s in rows {
            if s.is_sensitive {
                s.value = Some(self.decrypt(&s.value.unwrap_or_default())?);
            }
            decrypted.push(s);
        }
        Ok(decrypted)
    }

    pub fn encrypt(&self, plaintext: &str) -> String {
        let mut rng = rand::thread_rng();
        let nonce_bytes: [u8; 12] = rng.gen();
        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = self.cipher
            .encrypt(nonce, plaintext.as_bytes())
            .expect("encryption failed");
        let mut combined = nonce_bytes.to_vec();
        combined.extend_from_slice(&ciphertext);
        BASE64.encode(&combined)
    }

    fn decrypt(&self, data: &str) -> Result<String, AppError> {
        let combined = BASE64
            .decode(data)
            .map_err(|_| AppError::Internal("Failed to decode encrypted setting".into()))?;
        if combined.len() < 12 {
            return Err(AppError::Internal("Invalid encrypted setting data".into()));
        }
        let (nonce_bytes, ciphertext) = combined.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);
        let plaintext = self
            .cipher
            .decrypt(nonce, ciphertext)
            .map_err(|_| AppError::Internal("Failed to decrypt setting".into()))?;
        String::from_utf8(plaintext)
            .map_err(|_| AppError::Internal("Decrypted setting is not valid UTF-8".into()))
    }
}
