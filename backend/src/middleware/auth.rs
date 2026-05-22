use axum::{
    extract::FromRequestParts,
    http::request::Parts,
};
use uuid::Uuid;

use crate::error::AppError;
use crate::services::verify_token;

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct AuthUser {
    pub sub: String,
    pub patient_id: Option<Uuid>,
}

#[async_trait::async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get("Authorization")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "))
            .ok_or_else(|| AppError::Unauthorized("Missing Authorization header".to_string()))?;

        let secret = std::env::var("JWT_SECRET")
            .map_err(|_| AppError::Internal("JWT_SECRET not configured".to_string()))?;

        let claims = verify_token(auth_header, &secret)
            .map_err(|_| AppError::Unauthorized("Invalid or expired token".to_string()))?;

        Ok(AuthUser {
            sub: claims.sub,
            patient_id: claims.patient_id,
        })
    }
}
