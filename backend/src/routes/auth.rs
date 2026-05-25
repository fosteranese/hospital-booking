use axum::{Json, Router, extract::State, routing::post};
use serde::{Deserialize, Serialize};
use chrono::Utc;

use crate::error::AppError;
use crate::services::{create_otp, verify_otp, create_token, verify_token_ignore_expiry};
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
}

pub async fn request_otp(
    State(state): State<AppState>,
    Json(body): Json<RequestOtpRequest>,
) -> Result<Json<RequestOtpResponse>, AppError> {
    let identifier = body.identifier.trim().to_lowercase();

    if identifier.is_empty() {
        return Err(AppError::Validation("Identifier is required".to_string()));
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

    let valid = verify_otp(&state.pool, &identifier, &code)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to verify OTP: {}", e)))?;

    if !valid {
        return Err(AppError::Unauthorized("Invalid or expired OTP".to_string()));
    }

    let token = create_token(&identifier, &state.jwt_secret)
        .map_err(|e| AppError::Internal(format!("Failed to create token: {}", e)))?;

    Ok(Json(VerifyOtpResponse { token }))
}

#[derive(Deserialize)]
pub struct RefreshTokenRequest {
    pub token: String,
}

pub async fn refresh_token_handler(
    State(state): State<AppState>,
    Json(body): Json<RefreshTokenRequest>,
) -> Result<Json<VerifyOtpResponse>, AppError> {
    let claims = verify_token_ignore_expiry(&body.token, &state.jwt_secret)
        .map_err(|_| AppError::Unauthorized("Invalid token".to_string()))?;

    let now = Utc::now().timestamp();
    let max_age = REFRESH_GRACE_DAYS * 24 * 3600;
    if now - claims.iat as i64 > max_age {
        return Err(AppError::Unauthorized("Session expired. Please login again.".to_string()));
    }

    let token = create_token(&claims.sub, &state.jwt_secret)
        .map_err(|e| AppError::Internal(format!("Failed to create token: {}", e)))?;

    Ok(Json(VerifyOtpResponse { token }))
}

pub fn auth_routes() -> axum::Router<AppState> {
    Router::new()
        .route("/api/auth/request-otp", post(request_otp))
        .route("/api/auth/verify-otp", post(verify_otp_handler))
        .route("/api/auth/refresh", post(refresh_token_handler))
}
