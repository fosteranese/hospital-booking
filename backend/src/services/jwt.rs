use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use chrono::{Utc, Duration};
use uuid::Uuid;
use sha2::{Sha256, Digest};

pub fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    hex::encode(hasher.finalize())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub role: String,
    pub patient_id: Option<Uuid>,
    pub exp: usize,
    pub iat: usize,
    #[serde(default)]
    pub mfa_session: bool,
    #[serde(default)]
    pub mfa_method: String,
    #[serde(default)]
    pub mfa_session_phase: String,
    #[serde(default)]
    pub password_reset: bool,
}

pub fn create_token(identifier: &str, role: &str, secret: &str) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now();
    let claims = Claims {
        sub: identifier.to_string(),
        role: role.to_string(),
        patient_id: None,
        iat: now.timestamp() as usize,
        exp: (now + Duration::minutes(15)).timestamp() as usize,
        mfa_session: false,
        mfa_method: String::new(),
        mfa_session_phase: String::new(),
        password_reset: false,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
}

pub fn create_mfa_session_token(identifier: &str, role: &str, method: &str, secret: &str) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now();
    let claims = Claims {
        sub: identifier.to_string(),
        role: role.to_string(),
        patient_id: None,
        iat: now.timestamp() as usize,
        exp: (now + Duration::minutes(5)).timestamp() as usize,
        mfa_session: true,
        mfa_method: method.to_string(),
        mfa_session_phase: String::new(),
        password_reset: false,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
}

pub fn create_forgot_password_session_token(
    identifier: &str,
    role: &str,
    method: &str,
    phase: &str,
    secret: &str,
) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now();
    let claims = Claims {
        sub: identifier.to_string(),
        role: role.to_string(),
        patient_id: None,
        iat: now.timestamp() as usize,
        exp: (now + Duration::minutes(10)).timestamp() as usize,
        mfa_session: true,
        mfa_method: method.to_string(),
        mfa_session_phase: phase.to_string(),
        password_reset: false,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
}

pub fn create_reset_token(identifier: &str, role: &str, secret: &str) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now();
    let claims = Claims {
        sub: identifier.to_string(),
        role: role.to_string(),
        patient_id: None,
        iat: now.timestamp() as usize,
        exp: (now + Duration::minutes(5)).timestamp() as usize,
        mfa_session: false,
        mfa_method: String::new(),
        mfa_session_phase: String::new(),
        password_reset: true,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
}

pub fn verify_token(token: &str, secret: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )?;
    Ok(token_data.claims)
}

pub fn verify_token_ignore_expiry(token: &str, secret: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let mut validation = Validation::default();
    validation.validate_exp = false;
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )?;
    Ok(token_data.claims)
}
