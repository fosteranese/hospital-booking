use axum::{Json, Router, extract::State, routing::post};
use serde::{Deserialize, Serialize};
use chrono::Utc;

use crate::error::AppError;
use crate::services::{create_otp, verify_otp, create_token, verify_token_ignore_expiry, hash_token};
use crate::state::AppState;

const REFRESH_GRACE_DAYS: i64 = 7;

#[derive(Deserialize)]
pub struct RequestOtpRequest {
    pub identifier: String,
}

#[derive(Serialize)]
pub struct RequestOtpResponse {
    pub message: String,
}

#[derive(Deserialize)]
pub struct VerifyOtpRequest {
    pub identifier: String,
    pub code: String,
}

#[derive(Serialize)]
pub struct VerifyOtpResponse {
    pub token: String,
    pub role: String,
}

pub async fn request_otp(
    State(state): State<AppState>,
    Json(body): Json<RequestOtpRequest>,
) -> Result<Json<RequestOtpResponse>, AppError> {
    let identifier = body.identifier.trim().to_lowercase();

    if identifier.is_empty() {
        return Err(AppError::Validation("Identifier is required".to_string()));
    }

    if identifier.contains('@') && !identifier.contains('.') {
        return Err(AppError::Validation("Invalid email format".to_string()));
    }

    if !identifier.contains('@') {
        let digits: String = identifier.chars().filter(|c| c.is_ascii_digit()).collect();
        if digits.len() < 7 || digits.len() > 15 {
            return Err(AppError::Validation("Invalid phone number format".to_string()));
        }
    }

    {
        let limiter = state.otp_limiter.lock().unwrap();
        if !limiter.check(&identifier) {
            return Err(AppError::TooManyRequests("Too many OTP requests. Please try again later.".to_string()));
        }
    }

    let otp_length: usize = state.settings.get("otp", "length").await.ok().flatten()
        .and_then(|v| v.parse().ok())
        .unwrap_or(6);

    let code = create_otp(&state.pool, &identifier, otp_length)
        .await
        .map_err(|_| AppError::Internal("We couldn't send your verification code. Please try again.".to_string()))?;

    let delivery_ok = if identifier.contains('@') {
        state.email_service.send_otp(&identifier, &code).await
    } else {
        state.sms_service.send_otp(&identifier, &code).await
    };

    if delivery_ok.is_err() {
        tracing::warn!("OTP delivery failed but code was stored");
    }

    Ok(Json(RequestOtpResponse {
        message: "OTP sent successfully".to_string(),
    }))
}

pub async fn verify_otp_handler(
    State(state): State<AppState>,
    Json(body): Json<VerifyOtpRequest>,
) -> Result<Json<VerifyOtpResponse>, AppError> {
    let identifier = body.identifier.trim().to_lowercase();
    let code = body.code.trim().to_string();

    if code.len() < 4 || code.len() > 8 || !code.chars().all(|c| c.is_ascii_digit()) {
        return Err(AppError::Validation("Invalid verification code format".to_string()));
    }

    {
        let limiter = state.otp_limiter.lock().unwrap();
        if !limiter.check(&format!("verify:{}", identifier)) {
            return Err(AppError::TooManyRequests("Too many verification attempts. Please try again later.".to_string()));
        }
    }

    let valid = verify_otp(&state.pool, &identifier, &code)
        .await
        .map_err(|_| AppError::Internal("Failed to verify OTP. Please try again.".to_string()))?;

    if !valid {
        return Err(AppError::Unauthorized("Invalid or expired OTP".to_string()));
    }

    // Ensure user record exists (default role: patient)
    sqlx::query(
        "INSERT INTO users (identifier, role) VALUES ($1, 'patient') ON CONFLICT (identifier) DO NOTHING"
    )
    .bind(&identifier)
    .execute(&state.pool)
    .await
    .map_err(|_| AppError::Internal("Failed to create user".to_string()))?;

    let role: String = sqlx::query_scalar(
        "SELECT role FROM users WHERE identifier = $1"
    )
    .bind(&identifier)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| AppError::Internal("Failed to get user role".to_string()))?;

    let token = create_token(&identifier, &role, &state.jwt_secret)
        .map_err(|_| AppError::Internal("Failed to create token. Please try again.".to_string()))?;

    Ok(Json(VerifyOtpResponse { token, role }))
}

#[derive(Deserialize)]
pub struct RefreshTokenRequest {
    pub token: String,
}

async fn cleanup_blacklist(pool: &sqlx::PgPool) {
    let _ = sqlx::query("DELETE FROM token_blacklist WHERE expires_at <= NOW()")
        .execute(pool)
        .await;
}

async fn is_token_blacklisted(token: &str, pool: &sqlx::PgPool) -> Result<bool, AppError> {
    let token_hash = hash_token(token);
    let count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM token_blacklist WHERE token_hash = $1 AND expires_at > NOW()"
    )
    .bind(&token_hash)
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::Database(e))?;
    Ok(count > 0)
}

#[derive(Deserialize)]
pub struct InvalidateTokenRequest {
    pub token: String,
}

pub async fn invalidate_token_handler(
    State(state): State<AppState>,
    Json(body): Json<InvalidateTokenRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let claims = verify_token_ignore_expiry(&body.token, &state.jwt_secret)
        .map_err(|_| AppError::Unauthorized("Invalid token".to_string()))?;

    let token_hash = hash_token(&body.token);
    let expires_at = chrono::DateTime::from_timestamp(claims.exp as i64, 0)
        .ok_or_else(|| AppError::Internal("Invalid token expiry".to_string()))?;

    sqlx::query(
        "INSERT INTO token_blacklist (token_hash, expires_at) VALUES ($1, $2) ON CONFLICT (token_hash) DO NOTHING"
    )
    .bind(&token_hash)
    .bind(expires_at)
    .execute(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    cleanup_blacklist(&state.pool).await;

    Ok(Json(serde_json::json!({ "message": "Token invalidated" })))
}

pub async fn refresh_token_handler(
    State(state): State<AppState>,
    Json(body): Json<RefreshTokenRequest>,
) -> Result<Json<VerifyOtpResponse>, AppError> {
    if is_token_blacklisted(&body.token, &state.pool).await? {
        return Err(AppError::Unauthorized("Token has been invalidated".to_string()));
    }

    let claims = verify_token_ignore_expiry(&body.token, &state.jwt_secret)
        .map_err(|_| AppError::Unauthorized("Invalid token".to_string()))?;

    let now = Utc::now().timestamp();
    let max_age = REFRESH_GRACE_DAYS * 24 * 3600;
    if now - claims.iat as i64 > max_age {
        return Err(AppError::Unauthorized("Session expired. Please login again.".to_string()));
    }

    let token = create_token(&claims.sub, &claims.role, &state.jwt_secret)
        .map_err(|_| AppError::Internal("Failed to refresh token. Please login again.".to_string()))?;

    cleanup_blacklist(&state.pool).await;

    Ok(Json(VerifyOtpResponse { token, role: claims.role }))
}

pub fn auth_routes() -> axum::Router<AppState> {
    Router::new()
        .route("/api/auth/request-otp", post(request_otp))
        .route("/api/auth/verify-otp", post(verify_otp_handler))
        .route("/api/auth/refresh", post(refresh_token_handler))
        .route("/api/auth/invalidate", post(invalidate_token_handler))
}
