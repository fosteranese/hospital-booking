use axum::{
    extract::FromRequestParts,
    http::request::Parts,
};
use uuid::Uuid;

use crate::error::AppError;
use crate::services::{verify_token, hash_token};
use crate::state::AppState;

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct AuthUser {
    pub sub: String,
    pub role: String,
    pub patient_id: Option<Uuid>,
}

#[async_trait::async_trait]
impl FromRequestParts<AppState> for AuthUser
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get("Authorization")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "))
            .ok_or_else(|| AppError::Unauthorized("Missing Authorization header".to_string()))?;

        let claims = verify_token(auth_header, &state.jwt_secret)
            .map_err(|_| AppError::Unauthorized("Invalid or expired token".to_string()))?;

        let token_hash = hash_token(auth_header);
        let blacklisted = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM token_blacklist WHERE token_hash = $1 AND expires_at > NOW()"
        )
        .bind(&token_hash)
        .fetch_one(&state.pool)
        .await
        .map_err(|_| AppError::Internal("Failed to verify token".to_string()))?;

        if blacklisted > 0 {
            return Err(AppError::Unauthorized("Token has been invalidated".to_string()));
        }

        let _ = sqlx::query("DELETE FROM token_blacklist WHERE expires_at <= NOW()")
            .execute(&state.pool)
            .await;

        Ok(AuthUser {
            sub: claims.sub,
            role: claims.role,
            patient_id: claims.patient_id,
        })
    }
}

pub fn require_role(auth: &AuthUser, roles: &[&str]) -> Result<(), AppError> {
    if roles.contains(&auth.role.as_str()) {
        Ok(())
    } else {
        Err(AppError::Unauthorized("Insufficient permissions".to_string()))
    }
}
