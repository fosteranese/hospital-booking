use rand::Rng;
use sqlx::PgPool;
use chrono::{Utc, Duration};
use sha2::{Sha256, Digest};

use crate::models::OtpCode;

const OTP_EXPIRY_MINUTES: i64 = 10;

fn is_dev_mode() -> bool {
    std::env::var("DEV_MODE").is_ok()
}

fn hash_code(code: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(code.as_bytes());
    hex::encode(hasher.finalize())
}

pub fn generate_code(length: usize) -> String {
    if is_dev_mode() {
        return "123456".to_string();
    }
    let max = 10usize.pow(length as u32);
    let mut rng = rand::thread_rng();
    format!("{:0width$}", rng.gen_range(0..max), width = length)
}

pub async fn create_otp(pool: &PgPool, identifier: &str, length: usize) -> Result<String, sqlx::Error> {
    let code = generate_code(length);
    let hashed = hash_code(&code);
    let expires_at = Utc::now() + Duration::minutes(OTP_EXPIRY_MINUTES);

    sqlx::query(
        "INSERT INTO otp_codes (identifier, code, expires_at) VALUES ($1, $2, $3)"
    )
    .bind(identifier)
    .bind(&hashed)
    .bind(expires_at)
    .execute(pool)
    .await?;

    Ok(code)
}

pub async fn verify_otp(pool: &PgPool, identifier: &str, code: &str) -> Result<bool, sqlx::Error> {
    let hashed = hash_code(code);

    let result = sqlx::query_as::<_, OtpCode>(
        "SELECT * FROM otp_codes WHERE identifier = $1 AND code = $2 AND is_used = FALSE AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1"
    )
    .bind(identifier)
    .bind(&hashed)
    .fetch_optional(pool)
    .await?;

    if let Some(otp) = result {
        sqlx::query("UPDATE otp_codes SET is_used = TRUE WHERE id = $1")
            .bind(otp.id)
            .execute(pool)
            .await?;
        Ok(true)
    } else {
        Ok(false)
    }
}
