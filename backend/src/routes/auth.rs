use axum::{Json, Router, extract::State, routing::post, routing::get, routing::put};
use serde::{Deserialize, Serialize};
use chrono::Utc;
use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::AuthUser;
use crate::services::*;
use crate::state::AppState;

const REFRESH_GRACE_DAYS: i64 = 7;

// ─── Existing OTP types & handlers ───────────────────────────────────────

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

// ─── Social sign-in ──────────────────────────────────────────────────────
//
// Both routes end at the exact same place OTP verification does: a
// {token, role, identifier} triple the frontend hands to the same
// handleVerified() the OTP flow already calls. Neither provider gets a
// bespoke session shape -- from here on, the rest of the app has no idea
// (and doesn't need to know) which auth method actually ran. Identity
// linking is simply "the verified email matches an existing patient
// record's email", the same lookup OTP-verified email logins already use --
// no separate linked-accounts table, because there's nothing to link beyond
// what the identifier string itself already resolves to.

#[derive(Deserialize)]
pub struct OAuthRequest {
    pub id_token: String,
}

#[derive(Serialize)]
pub struct OAuthResponse {
    pub token: String,
    pub role: String,
    pub identifier: String,
}

// Shared by both providers once each has independently verified a token and
// extracted a trustworthy email: upsert into `users`, issue the same app JWT
// OTP verification issues, done. This is the one place that shape lives, so
// a third provider later is a new verify() call into this, not a new copy
// of the session-issuing logic.
async fn issue_oauth_session(state: &AppState, identifier: String) -> Result<OAuthResponse, AppError> {
    sqlx::query(
        "INSERT INTO users (identifier, role) VALUES ($1, 'patient') ON CONFLICT (identifier) DO NOTHING"
    )
    .bind(&identifier)
    .execute(&state.pool)
    .await
    .map_err(|_| AppError::Internal("Failed to create user".to_string()))?;

    let role: String = sqlx::query_scalar("SELECT role FROM users WHERE identifier = $1")
        .bind(&identifier)
        .fetch_one(&state.pool)
        .await
        .map_err(|_| AppError::Internal("Failed to get user role".to_string()))?;

    let token = create_token(&identifier, &role, &state.jwt_secret)
        .map_err(|_| AppError::Internal("Failed to create token. Please try again.".to_string()))?;

    Ok(OAuthResponse { token, role, identifier })
}

pub async fn oauth_google_handler(
    State(state): State<AppState>,
    Json(body): Json<OAuthRequest>,
) -> Result<Json<OAuthResponse>, AppError> {
    let google = state.google_oauth.as_ref().ok_or_else(|| {
        AppError::ServiceUnavailable("Sign in with Google is not configured on this server".to_string())
    })?;

    let claims = google.verify(&body.id_token).await
        .map_err(AppError::Unauthorized)?;
    let identifier = claims.email.trim().to_lowercase();

    Ok(Json(issue_oauth_session(&state, identifier).await?))
}

// "Sign in with Apple JS" hands the frontend a real, independently
// verifiable Apple-signed id_token client-side -- verifying it needs only
// APPLE_SERVICES_ID (the audience), not the Team ID / Key ID / private key
// (those are only for the authorization-code exchange, which this app never
// does). See services/oauth.rs's module comment for why, and for the one
// real extra requirement Apple has that Google doesn't: a domain-verified
// HTTPS origin registered in the Apple Developer portal (no localhost
// allowance, unlike Google's "Authorized JavaScript origins").
pub async fn oauth_apple_handler(
    State(state): State<AppState>,
    Json(body): Json<OAuthRequest>,
) -> Result<Json<OAuthResponse>, AppError> {
    let apple = state.apple_oauth.as_ref().ok_or_else(|| {
        AppError::ServiceUnavailable("Sign in with Apple is not configured on this server".to_string())
    })?;

    let claims = apple.verify(&body.id_token).await
        .map_err(AppError::Unauthorized)?;
    let identifier = claims.email
        .ok_or_else(|| AppError::Unauthorized("Apple did not include an email on this sign-in".to_string()))?
        .trim()
        .to_lowercase();

    Ok(Json(issue_oauth_session(&state, identifier).await?))
}

// ─── Existing token management handlers ─────────────────────────────────

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

// ─── NEW: Password + MFA Login ──────────────────────────────────────────

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_token: Option<String>,
    pub mfa_methods: Vec<String>,
    pub default_method: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
}

#[derive(Deserialize)]
pub struct MfaChallengeRequest {
    pub session_token: String,
    pub method: String,
}

#[derive(Serialize)]
pub struct MfaChallengeResponse {
    pub message: String,
    pub method: String,
    pub session_token: String,
}

#[derive(Deserialize)]
pub struct MfaVerifyRequest {
    pub session_token: String,
    pub code: String,
}

#[derive(Serialize)]
pub struct MfaVerifyResponse {
    pub token: String,
    pub role: String,
}

#[derive(Deserialize)]
pub struct SetPasswordRequest {
    pub current_password: Option<String>,
    pub new_password: String,
}

#[derive(Serialize)]
pub struct SetPasswordResponse {
    pub message: String,
}

#[derive(Serialize)]
pub struct MfaStatusResponse {
    pub has_password: bool,
    pub mfa_methods: Vec<String>,
    pub has_mfa_secret: bool,
    pub email: String,
    pub phone: String,
}

#[derive(Deserialize)]
pub struct SetupMfaRequest {
    pub mfa_methods: Vec<String>,
    pub phone: Option<String>,
}

#[derive(Serialize)]
pub struct SetupMfaResponse {
    pub mfa_methods: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mfa_secret: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub otpauth_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub qr_code_svg: Option<String>,
    pub message: String,
}

const STAFF_ROLES: &[&str] = &["admin", "scheduler", "doctor"];

/// Step 1: Email + password verification.
/// Returns MFA methods with email auto-challenged by default.
pub async fn login_handler(
    State(state): State<AppState>,
    Json(body): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, AppError> {
    let email = body.email.trim().to_lowercase();

    if email.is_empty() {
        return Err(AppError::Validation("Email is required".to_string()));
    }

    // Rate limit login attempts
    {
        let limiter = state.mutation_limiter.lock().unwrap();
        if !limiter.check(&format!("login:{}", email)) {
            return Err(AppError::TooManyRequests("Too many login attempts. Please try again later.".to_string()));
        }
    }

    // Fetch user
    let user_row = sqlx::query_as::<_, (String, String, Option<String>, String, Option<String>)>(
        "SELECT identifier, role, password_hash, COALESCE(mfa_methods, ''), phone FROM users WHERE LOWER(identifier) = $1"
    )
    .bind(&email)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to look up user: {:?}", e);
        AppError::Internal("Failed to look up user".to_string())
    })?;

    let (identifier, role, password_hash, mfa_methods_str, _phone) = match user_row {
        Some(u) => u,
        None => return Err(AppError::Unauthorized("Invalid email or password".to_string())),
    };

    // Only staff can use password login
    if !STAFF_ROLES.contains(&role.as_str()) {
        return Err(AppError::Unauthorized("Invalid email or password".to_string()));
    }

    let mfa_methods: Vec<String> = if mfa_methods_str.is_empty() {
        vec![]
    } else {
        mfa_methods_str.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect()
    };

    // Verify password
    let hash = password_hash.ok_or_else(||
        AppError::Unauthorized("Password not set. Please contact an administrator.".to_string())
    )?;
    let valid = verify_password(&body.password, &hash)
        .map_err(|_| AppError::Internal("Failed to verify password".to_string()))?;

    if !valid {
        return Err(AppError::Unauthorized("Invalid email or password".to_string()));
    }

    // If MFA is not configured, return error — staff must have MFA
    if mfa_methods.is_empty() {
        return Err(AppError::Unauthorized(
            "Multi-factor authentication is not configured. Please set up MFA in Settings.".to_string()
        ));
    }

    // Create MFA session token — user will choose their preferred method
    let session_token = create_mfa_session_token(&identifier, &role, "", &state.jwt_secret)
        .map_err(|_| AppError::Internal("Failed to create session".to_string()))?;

    Ok(Json(LoginResponse {
        session_token: Some(session_token),
        mfa_methods,
        default_method: String::new(),
        message: "Choose your preferred verification method".to_string(),
        token: None,
        role: None,
    }))
}

/// Step 2: Request MFA challenge (send OTP or prepare authenticator).
pub async fn mfa_challenge_handler(
    State(state): State<AppState>,
    Json(body): Json<MfaChallengeRequest>,
) -> Result<Json<MfaChallengeResponse>, AppError> {
    let claims = verify_token(&body.session_token, &state.jwt_secret)
        .map_err(|_| AppError::Unauthorized("Invalid or expired session".to_string()))?;

    if !claims.mfa_session {
        return Err(AppError::Unauthorized("Invalid session token".to_string()));
    }

    let method = body.method.trim().to_lowercase();
    if !["email", "phone", "authenticator"].contains(&method.as_str()) {
        return Err(AppError::Validation("Invalid MFA method. Supported: email, phone, authenticator".to_string()));
    }

    // Verify the user has this method configured
    let mfa_methods_str: String = sqlx::query_scalar(
        "SELECT COALESCE(mfa_methods, '') FROM users WHERE identifier = $1"
    )
    .bind(&claims.sub)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| AppError::Internal("Failed to look up user".to_string()))?
    .unwrap_or_default();

    let mfa_methods: Vec<&str> = mfa_methods_str.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()).collect();
    if !mfa_methods.contains(&method.as_str()) {
        return Err(AppError::Validation("MFA method not configured".to_string()));
    }

    // Rate limit challenges
    {
        let limiter = state.otp_limiter.lock().unwrap();
        if !limiter.check(&format!("mfa_challenge:{}", claims.sub)) {
            return Err(AppError::TooManyRequests("Too many MFA requests. Please try again later.".to_string()));
        }
    }

    let message = match method.as_str() {
        "email" => {
            let otp_length: usize = state.settings.get("otp", "length").await.ok().flatten()
                .and_then(|v| v.parse().ok())
                .unwrap_or(6);
            let code = create_otp(&state.pool, &claims.sub, otp_length)
                .await
                .map_err(|_| AppError::Internal("Failed to send code".to_string()))?;
            state.email_service.send_otp(&claims.sub, &code).await.ok();
            "Verification code sent to your email".to_string()
        }
        "phone" => {
            let phone: Option<String> = sqlx::query_scalar(
                "SELECT phone FROM users WHERE identifier = $1"
            )
            .bind(&claims.sub)
            .fetch_optional(&state.pool)
            .await
            .map_err(|_| AppError::Internal("Failed to look up phone".to_string()))?
            .flatten();

            match phone {
                Some(ref p) if !p.is_empty() => {
                    let otp_length: usize = state.settings.get("otp", "length").await.ok().flatten()
                        .and_then(|v| v.parse().ok())
                        .unwrap_or(6);
                    let code = create_otp(&state.pool, &claims.sub, otp_length)
                        .await
                        .map_err(|_| AppError::Internal("Failed to send code".to_string()))?;
                    state.sms_service.send_otp(p, &code).await.ok();
                    format!("Verification code sent to {}", p)
                }
                _ => return Err(AppError::Validation("No phone number configured for MFA".to_string())),
            }
        }
        "authenticator" => {
            // No sending needed — user opens their authenticator app
            "Open your authenticator app and enter the code".to_string()
        }
        _ => unreachable!(),
    };

    // Issue new session token with the method embedded
    let session_token = create_mfa_session_token(&claims.sub, &claims.role, &method, &state.jwt_secret)
        .map_err(|_| AppError::Internal("Failed to create session".to_string()))?;

    Ok(Json(MfaChallengeResponse {
        message,
        method,
        session_token,
    }))
}

/// Step 3: Verify MFA code and issue JWT.
pub async fn mfa_verify_handler(
    State(state): State<AppState>,
    Json(body): Json<MfaVerifyRequest>,
) -> Result<Json<MfaVerifyResponse>, AppError> {
    let claims = verify_token(&body.session_token, &state.jwt_secret)
        .map_err(|_| AppError::Unauthorized("Invalid or expired session".to_string()))?;

    if !claims.mfa_session {
        return Err(AppError::Unauthorized("Invalid session token".to_string()));
    }

    let code = body.code.trim();
    if code.is_empty() {
        return Err(AppError::Validation("Verification code is required".to_string()));
    }

    let method = claims.mfa_method.as_str();

    // Rate limit verification attempts
    {
        let limiter = state.otp_limiter.lock().unwrap();
        if !limiter.check(&format!("mfa_verify:{}", claims.sub)) {
            return Err(AppError::TooManyRequests("Too many verification attempts. Please try again later.".to_string()));
        }
    }

    let valid = match method {
        "email" | "phone" => {
            if code.len() < 4 || code.len() > 8 || !code.chars().all(|c| c.is_ascii_digit()) {
                return Err(AppError::Validation("Invalid verification code format".to_string()));
            }
            verify_otp(&state.pool, &claims.sub, code)
                .await
                .map_err(|_| AppError::Internal("Failed to verify code".to_string()))?
        }
        "authenticator" => {
            if code.len() < 4 || code.len() > 8 || !code.chars().all(|c| c.is_ascii_digit()) {
                return Err(AppError::Validation("Invalid verification code format".to_string()));
            }
            let secret: Option<String> = sqlx::query_scalar(
                "SELECT mfa_secret FROM users WHERE identifier = $1"
            )
            .bind(&claims.sub)
            .fetch_optional(&state.pool)
            .await
            .map_err(|_| AppError::Internal("Failed to look up MFA secret".to_string()))?
            .flatten();

            match secret {
                Some(s) if !s.is_empty() => verify_totp(&s, code).map_err(|_| AppError::Internal("Failed to verify code".to_string()))?,
                _ => return Err(AppError::Validation("Authenticator not set up. Please configure it in Settings.".to_string())),
            }
        }
        _ => return Err(AppError::Validation("Invalid MFA method".to_string())),
    };

    if !valid {
        return Err(AppError::Unauthorized("Invalid verification code".to_string()));
    }

    // Fetch current role
    let role: String = sqlx::query_scalar(
        "SELECT role FROM users WHERE identifier = $1"
    )
    .bind(&claims.sub)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| AppError::Internal("Failed to get user role".to_string()))?;

    let token = create_token(&claims.sub, &role, &state.jwt_secret)
        .map_err(|_| AppError::Internal("Failed to create token".to_string()))?;

    Ok(Json(MfaVerifyResponse { token, role }))
}

/// Set or change password.
pub async fn set_password_handler(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<SetPasswordRequest>,
) -> Result<Json<SetPasswordResponse>, AppError> {
    if !STAFF_ROLES.contains(&auth.role.as_str()) {
        return Err(AppError::Unauthorized("Only staff can set passwords".to_string()));
    }

    let new_password = body.new_password.trim();
    if new_password.len() < 8 {
        return Err(AppError::Validation("Password must be at least 8 characters".to_string()));
    }

    // Check current password if one exists
    let current_hash: Option<String> = sqlx::query_scalar(
        "SELECT password_hash FROM users WHERE identifier = $1"
    )
    .bind(&auth.sub)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| AppError::Internal("Failed to look up user".to_string()))?
    .flatten();

    if let Some(ref hash) = current_hash {
        // Password already set — verify current password
        let current = body.current_password.as_deref().unwrap_or("");
        let valid = verify_password(current, hash)
            .map_err(|_| AppError::Internal("Failed to verify password".to_string()))?;
        if !valid {
            return Err(AppError::Unauthorized("Current password is incorrect".to_string()));
        }
    }

    let new_hash = hash_password(new_password)
        .map_err(|_| AppError::Internal("Failed to hash password".to_string()))?;

    sqlx::query("UPDATE users SET password_hash = $1 WHERE identifier = $2")
        .bind(&new_hash)
        .bind(&auth.sub)
        .execute(&state.pool)
        .await
        .map_err(|_| AppError::Internal("Failed to update password".to_string()))?;

    Ok(Json(SetPasswordResponse {
        message: "Password updated successfully".to_string(),
    }))
}

/// Get current MFA configuration.
pub async fn mfa_status_handler(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<MfaStatusResponse>, AppError> {
    let row = sqlx::query_as::<_, (String, Option<String>, String, Option<String>)>(
        "SELECT COALESCE(mfa_methods, ''), password_hash, identifier, phone FROM users WHERE identifier = $1"
    )
    .bind(&auth.sub)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| AppError::Internal("Failed to look up user".to_string()))?
    .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    let (mfa_methods_str, password_hash, email, phone) = row;

    let mfa_methods: Vec<String> = mfa_methods_str
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    let has_mfa_secret: bool = {
        let secret: Option<String> = sqlx::query_scalar(
            "SELECT mfa_secret FROM users WHERE identifier = $1"
        )
        .bind(&auth.sub)
        .fetch_optional(&state.pool)
        .await
        .map_err(|_| AppError::Internal("Failed to look up MFA secret".to_string()))?
        .flatten();
        secret.as_deref().map_or(false, |s| !s.is_empty())
    };

    Ok(Json(MfaStatusResponse {
        has_password: password_hash.is_some(),
        mfa_methods,
        has_mfa_secret,
        email,
        phone: phone.unwrap_or_default(),
    }))
}

/// Update MFA configuration.
pub async fn setup_mfa_handler(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<SetupMfaRequest>,
) -> Result<Json<SetupMfaResponse>, AppError> {
    if !STAFF_ROLES.contains(&auth.role.as_str()) {
        return Err(AppError::Unauthorized("Only staff can configure MFA".to_string()));
    }

    // Validate methods
    let mut methods: Vec<String> = body.mfa_methods.into_iter()
        .map(|m| m.trim().to_lowercase())
        .filter(|m| !m.is_empty())
        .collect::<Vec<_>>();

    // Deduplicate
    methods.sort();
    methods.dedup();

    // Validate against allowed methods
    for method in &methods {
        if !["email", "phone", "authenticator"].contains(&method.as_str()) {
            return Err(AppError::Validation(format!("Invalid MFA method: {}", method)));
        }
    }

    if methods.is_empty() {
        return Err(AppError::Validation("At least one MFA method must be selected".to_string()));
    }

    // Check password is set (MFA requires password)
    let has_password: bool = {
        let hash: Option<String> = sqlx::query_scalar(
            "SELECT password_hash FROM users WHERE identifier = $1"
        )
        .bind(&auth.sub)
        .fetch_optional(&state.pool)
        .await
        .map_err(|_| AppError::Internal("Failed to look up user".to_string()))?
        .flatten();
        hash.is_some()
    };

    if !has_password {
        return Err(AppError::Validation("You must set a password before configuring MFA".to_string()));
    }

    // If "phone" is in methods, phone number is required
    if methods.contains(&"phone".to_string()) {
        let phone = body.phone.as_deref().unwrap_or("");
        if phone.is_empty() {
            return Err(AppError::Validation("Phone number is required for phone MFA".to_string()));
        }
        // Update phone
        sqlx::query("UPDATE users SET phone = $1 WHERE identifier = $2")
            .bind(phone)
            .bind(&auth.sub)
            .execute(&state.pool)
            .await
            .map_err(|_| AppError::Internal("Failed to update phone".to_string()))?;
    }

    let methods_str = methods.join(",");

    // Check if authenticator is being added and no secret exists yet
    let mut mfa_secret: Option<String> = None;
    let mut otpauth_url: Option<String> = None;
    let mut qr_code_svg: Option<String> = None;

    if methods.contains(&"authenticator".to_string()) {
        let existing_secret: Option<String> = sqlx::query_scalar(
            "SELECT mfa_secret FROM users WHERE identifier = $1"
        )
        .bind(&auth.sub)
        .fetch_optional(&state.pool)
        .await
        .map_err(|_| AppError::Internal("Failed to look up MFA secret".to_string()))?
        .flatten();

        if existing_secret.as_deref().map_or(true, |s| s.is_empty()) {
            // Generate new TOTP setup
            let setup = generate_totp_setup(&auth.sub)
                .map_err(|e| AppError::Internal(e))?;

            sqlx::query("UPDATE users SET mfa_secret = $1 WHERE identifier = $2")
                .bind(&setup.secret)
                .bind(&auth.sub)
                .execute(&state.pool)
                .await
                .map_err(|_| AppError::Internal("Failed to save MFA secret".to_string()))?;

            mfa_secret = Some(setup.secret);
            otpauth_url = Some(setup.otpauth_url);
            qr_code_svg = Some(setup.qr_code_svg);
        }
    }

    sqlx::query("UPDATE users SET mfa_methods = $1 WHERE identifier = $2")
        .bind(&methods_str)
        .bind(&auth.sub)
        .execute(&state.pool)
        .await
        .map_err(|_| AppError::Internal("Failed to update MFA methods".to_string()))?;

    Ok(Json(SetupMfaResponse {
        mfa_methods: methods,
        mfa_secret,
        otpauth_url,
        qr_code_svg,
        message: "MFA settings updated".to_string(),
    }))
}

// ─── Forgot Password ──────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct ForgotPasswordInitRequest {
    pub email: String,
}

#[derive(Serialize)]
pub struct ForgotPasswordInitResponse {
    pub session_token: String,
    pub mfa_methods: Vec<String>,
    pub message: String,
    pub next_method: String,
}

#[derive(Deserialize)]
pub struct ForgotPasswordVerifyRequest {
    pub session_token: String,
    pub method: String,
    pub code: String,
}

#[derive(Serialize)]
pub struct ForgotPasswordVerifyResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reset_token: Option<String>,
    pub message: String,
    pub phase: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_method: Option<String>,
}

#[derive(Deserialize)]
pub struct ForgotPasswordResetRequest {
    pub reset_token: String,
    pub new_password: String,
}

#[derive(Serialize)]
pub struct ForgotPasswordResetResponse {
    pub message: String,
}

/// Step 1: Initiate forgot password flow.
pub async fn forgot_password_init_handler(
    State(state): State<AppState>,
    Json(body): Json<ForgotPasswordInitRequest>,
) -> Result<Json<ForgotPasswordInitResponse>, AppError> {
    let email = body.email.trim().to_lowercase();
    if email.is_empty() {
        return Err(AppError::Validation("Email is required".to_string()));
    }

    // Rate limit
    {
        let limiter = state.otp_limiter.lock().unwrap();
        if !limiter.check(&format!("forgot_pw:{}", email)) {
            return Err(AppError::TooManyRequests("Too many requests. Please try again later.".to_string()));
        }
    }

    let user = sqlx::query_as::<_, (String, String, Option<String>, String)>(
        "SELECT identifier, role, password_hash, COALESCE(mfa_methods, '') FROM users WHERE LOWER(identifier) = $1"
    )
    .bind(&email)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| AppError::Internal("Database error".to_string()))?
    .ok_or_else(|| AppError::NotFound("No account found with that email".to_string()))?;

    let (_identifier, role, password_hash, mfa_methods_str) = user;

    // Must have a password set
    if password_hash.is_none() {
        return Err(AppError::Validation("This account does not have a password set".to_string()));
    }

    let mfa_methods: Vec<String> = if mfa_methods_str.is_empty() {
        vec![]
    } else {
        mfa_methods_str.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect()
    };

    // Must have at least 2 MFA methods
    if mfa_methods.len() < 2 {
        return Err(AppError::Validation(
            "This account requires at least 2 MFA methods configured for password recovery".to_string()
        ));
    }

    // Pick the first method to send OTP
    let first_method = if mfa_methods.contains(&"email".to_string()) {
        "email"
    } else if mfa_methods.contains(&"phone".to_string()) {
        "phone"
    } else {
        "authenticator"
    };

    // Send OTP
    let message = match first_method {
        "email" => {
            let otp_length: usize = state.settings.get("otp", "length").await.ok().flatten()
                .and_then(|v| v.parse().ok())
                .unwrap_or(6);
            if let Ok(code) = create_otp(&state.pool, &email, otp_length).await {
                state.email_service.send_otp(&email, &code).await.ok();
            }
            "Verification code sent to your email".to_string()
        }
        "phone" => {
            let phone: Option<String> = sqlx::query_scalar("SELECT phone FROM users WHERE identifier = $1")
                .bind(&email)
                .fetch_optional(&state.pool)
                .await
                .map_err(|_| AppError::Internal("Database error".to_string()))?
                .flatten();
            match phone {
                Some(ref p) if !p.is_empty() => {
                    let otp_length: usize = state.settings.get("otp", "length").await.ok().flatten()
                        .and_then(|v| v.parse().ok())
                        .unwrap_or(6);
                    if let Ok(code) = create_otp(&state.pool, &email, otp_length).await {
                        state.sms_service.send_otp(p, &code).await.ok();
                    }
                    format!("Verification code sent to {}", p)
                }
                _ => "Unable to send SMS — no phone on file".to_string(),
            }
        }
        "authenticator" => {
            "Open your authenticator app and enter the code".to_string()
        }
        _ => unreachable!(),
    };

    let session_token = create_forgot_password_session_token(&email, &role, first_method, "first", &state.jwt_secret)
        .map_err(|_| AppError::Internal("Failed to create session".to_string()))?;

    Ok(Json(ForgotPasswordInitResponse {
        session_token,
        mfa_methods,
        message,
        next_method: first_method.to_string(),
    }))
}

/// Step 2: Verify MFA code during forgot password flow.
pub async fn forgot_password_verify_handler(
    State(state): State<AppState>,
    Json(body): Json<ForgotPasswordVerifyRequest>,
) -> Result<Json<ForgotPasswordVerifyResponse>, AppError> {
    let claims = verify_token(&body.session_token, &state.jwt_secret)
        .map_err(|_| AppError::Unauthorized("Invalid or expired session".to_string()))?;

    if !claims.mfa_session || claims.mfa_session_phase.is_empty() {
        return Err(AppError::Unauthorized("Invalid session token".to_string()));
    }

    let code = body.code.trim();
    if code.is_empty() {
        return Err(AppError::Validation("Verification code is required".to_string()));
    }

    let method = body.method.trim().to_lowercase();
    if !["email", "phone", "authenticator"].contains(&method.as_str()) {
        return Err(AppError::Validation("Invalid MFA method".to_string()));
    }

    // Rate limit
    {
        let limiter = state.otp_limiter.lock().unwrap();
        if !limiter.check(&format!("forgot_pw_verify:{}", claims.sub)) {
            return Err(AppError::TooManyRequests("Too many attempts. Please try again later.".to_string()));
        }
    }

    // Verify the code against the submitted method
    let valid = match method.as_str() {
        "email" | "phone" => {
            if code.len() < 4 || code.len() > 8 || !code.chars().all(|c| c.is_ascii_digit()) {
                return Err(AppError::Validation("Invalid verification code format".to_string()));
            }
            verify_otp(&state.pool, &claims.sub, code)
                .await
                .map_err(|_| AppError::Internal("Failed to verify code".to_string()))?
        }
        "authenticator" => {
            if code.len() < 4 || code.len() > 8 || !code.chars().all(|c| c.is_ascii_digit()) {
                return Err(AppError::Validation("Invalid verification code format".to_string()));
            }
            let secret: Option<String> = sqlx::query_scalar("SELECT mfa_secret FROM users WHERE identifier = $1")
                .bind(&claims.sub)
                .fetch_optional(&state.pool)
                .await
                .map_err(|_| AppError::Internal("Database error".to_string()))?
                .flatten();
            match secret {
                Some(s) if !s.is_empty() => verify_totp(&s, code).map_err(|_| AppError::Internal("Failed to verify code".to_string()))?,
                _ => return Err(AppError::Validation("Authenticator not set up".to_string())),
            }
        }
        _ => unreachable!(),
    };

    if !valid {
        return Err(AppError::Unauthorized("Invalid verification code".to_string()));
    }

    // Get available MFA methods
    let mfa_methods_str: String = sqlx::query_scalar(
        "SELECT COALESCE(mfa_methods, '') FROM users WHERE identifier = $1"
    )
    .bind(&claims.sub)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| AppError::Internal("Database error".to_string()))?
    .unwrap_or_default();

    let all_methods: Vec<&str> = mfa_methods_str.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()).collect();
    let phase = claims.mfa_session_phase.as_str();

    match phase {
        "first" => {
            // Determine remaining methods (different from the one just used)
            let remaining: Vec<&&str> = all_methods.iter().filter(|m| **m != method.as_str()).collect();
            if remaining.is_empty() {
                return Err(AppError::Internal("No remaining MFA methods available".to_string()));
            }

            let next_method = remaining[0];

            // Auto-send OTP for the second method
            let message = match *next_method {
                "email" => {
                    let otp_length: usize = state.settings.get("otp", "length").await.ok().flatten()
                        .and_then(|v| v.parse().ok())
                        .unwrap_or(6);
                    if let Ok(code) = create_otp(&state.pool, &claims.sub, otp_length).await {
                        state.email_service.send_otp(&claims.sub, &code).await.ok();
                    }
                    "First code verified. Code sent to your email.".to_string()
                }
                "phone" => {
                    let phone: Option<String> = sqlx::query_scalar("SELECT phone FROM users WHERE identifier = $1")
                        .bind(&claims.sub)
                        .fetch_optional(&state.pool)
                        .await
                        .map_err(|_| AppError::Internal("Database error".to_string()))?
                        .flatten();
                    match phone {
                        Some(ref p) if !p.is_empty() => {
                            let otp_length: usize = state.settings.get("otp", "length").await.ok().flatten()
                                .and_then(|v| v.parse().ok())
                                .unwrap_or(6);
                            if let Ok(code) = create_otp(&state.pool, &claims.sub, otp_length).await {
                                state.sms_service.send_otp(p, &code).await.ok();
                            }
                            format!("First code verified. Code sent to {}.", p)
                        }
                        _ => "First code verified.".to_string(),
                    }
                }
                "authenticator" => {
                    "First code verified. Open your authenticator app.".to_string()
                }
                _ => unreachable!(),
            };

            // Create session for second phase
            let new_session = create_forgot_password_session_token(
                &claims.sub, &claims.role, next_method, "second", &state.jwt_secret,
            )
            .map_err(|_| AppError::Internal("Failed to create session".to_string()))?;

            Ok(Json(ForgotPasswordVerifyResponse {
                session_token: Some(new_session),
                reset_token: None,
                message,
                phase: "second".to_string(),
                next_method: Some(next_method.to_string()),
            }))
        }
        "second" => {
            // All MFA verified — issue reset token
            let reset_token = create_reset_token(&claims.sub, &claims.role, &state.jwt_secret)
                .map_err(|_| AppError::Internal("Failed to create reset token".to_string()))?;

            Ok(Json(ForgotPasswordVerifyResponse {
                session_token: None,
                reset_token: Some(reset_token),
                message: "Identity verified. You can now reset your password.".to_string(),
                phase: "done".to_string(),
                next_method: None,
            }))
        }
        _ => Err(AppError::Unauthorized("Invalid session phase".to_string())),
    }
}

/// Step 3: Reset password after forgot password flow.
pub async fn forgot_password_reset_handler(
    State(state): State<AppState>,
    Json(body): Json<ForgotPasswordResetRequest>,
) -> Result<Json<ForgotPasswordResetResponse>, AppError> {
    let claims = verify_token(&body.reset_token, &state.jwt_secret)
        .map_err(|_| AppError::Unauthorized("Invalid or expired reset token".to_string()))?;

    if !claims.password_reset {
        return Err(AppError::Unauthorized("Invalid reset token".to_string()));
    }

    let new_password = body.new_password.trim();
    if new_password.len() < 8 {
        return Err(AppError::Validation("Password must be at least 8 characters".to_string()));
    }

    let hash = hash_password(new_password)
        .map_err(|_| AppError::Internal("Failed to hash password".to_string()))?;

    sqlx::query("UPDATE users SET password_hash = $1 WHERE identifier = $2")
        .bind(&hash)
        .bind(&claims.sub)
        .execute(&state.pool)
        .await
        .map_err(|_| AppError::Internal("Failed to update password".to_string()))?;

    Ok(Json(ForgotPasswordResetResponse {
        message: "Password reset successfully".to_string(),
    }))
}

// ─── Profile ──────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct ProfileResponse {
    pub identifier: String,
    pub role: String,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub doctor_id: Option<Uuid>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub first_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub specialization: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,
}

pub async fn profile_handler(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<ProfileResponse>, AppError> {
    let user = sqlx::query_as::<_, (String, String, chrono::DateTime<chrono::Utc>)>(
        "SELECT identifier, role, created_at FROM users WHERE identifier = $1"
    )
    .bind(&auth.sub)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?
    .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    let (identifier, role, created_at) = user;

    let mut response = ProfileResponse {
        identifier,
        role: role.clone(),
        created_at: created_at.to_rfc3339(),
        doctor_id: None,
        first_name: None,
        last_name: None,
        specialization: None,
        email: None,
        phone: None,
    };

    if role == "doctor" {
        let doctor = sqlx::query_as::<_, (Uuid, String, String, String, String, Option<String>)>(
            "SELECT id, first_name, last_name, specialization, email, phone FROM doctors WHERE email = $1"
        )
        .bind(&auth.sub)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| AppError::Database(e))?;

        if let Some((id, first_name, last_name, specialization, email, phone)) = doctor {
            response.doctor_id = Some(id);
            response.first_name = Some(first_name);
            response.last_name = Some(last_name);
            response.specialization = Some(specialization);
            response.email = Some(email);
            response.phone = phone;
        }
    }

    Ok(Json(response))
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct DashboardStatsResponse {
    pub today_appointments: i64,
    pub missed_today: i64,
    pub tomorrow_appointments: i64,
    pub this_week_appointments: i64,
    pub last_week_appointments: i64,
    pub this_month_appointments: i64,
    pub last_month_appointments: i64,
    pub this_year_appointments: i64,
    pub last_year_appointments: i64,
    pub total_appointments: i64,
}

pub async fn dashboard_stats_handler(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<DashboardStatsResponse>, AppError> {
    let doctor_id = if auth.role == "doctor" {
        Some(sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM doctors WHERE email = $1"
        )
        .bind(&auth.sub)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| AppError::Database(e))?
        .ok_or_else(|| AppError::Unauthorized("Doctor profile not found".to_string()))?)
    } else {
        None
    };

    let (today_appointments, missed_today, tomorrow_appointments, this_week_appointments, last_week_appointments, this_month_appointments, last_month_appointments, this_year_appointments, last_year_appointments) =
        if let Some(did) = doctor_id {
            sqlx::query_as::<_, (i64, i64, i64, i64, i64, i64, i64, i64, i64)>(
                "SELECT
                    COUNT(*) FILTER (WHERE s.slot_date = CURRENT_DATE AND a.status != 'cancelled'),
                    COUNT(*) FILTER (WHERE s.slot_date = CURRENT_DATE AND a.attended = false),
                    COUNT(*) FILTER (WHERE s.slot_date = CURRENT_DATE + 1 AND a.status != 'cancelled'),
                    COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM s.slot_date) = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(WEEK FROM s.slot_date) = EXTRACT(WEEK FROM CURRENT_DATE) AND a.status != 'cancelled'),
                    COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM s.slot_date) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '7 days') AND EXTRACT(WEEK FROM s.slot_date) = EXTRACT(WEEK FROM CURRENT_DATE - INTERVAL '7 days') AND a.status != 'cancelled'),
                    COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM s.slot_date) = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM s.slot_date) = EXTRACT(MONTH FROM CURRENT_DATE) AND a.status != 'cancelled'),
                    COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM s.slot_date) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(MONTH FROM s.slot_date) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month') AND a.status != 'cancelled'),
                    COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM s.slot_date) = EXTRACT(YEAR FROM CURRENT_DATE) AND a.status != 'cancelled'),
                    COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM s.slot_date) = EXTRACT(YEAR FROM CURRENT_DATE) - 1 AND a.status != 'cancelled')
                 FROM appointments a
                 JOIN availability_slots s ON a.slot_id = s.id
                 WHERE a.doctor_id = $1"
            )
            .bind(did)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| AppError::Database(e))?
        } else {
            sqlx::query_as::<_, (i64, i64, i64, i64, i64, i64, i64, i64, i64)>(
                "SELECT
                    COUNT(*) FILTER (WHERE s.slot_date = CURRENT_DATE AND a.status != 'cancelled'),
                    COUNT(*) FILTER (WHERE s.slot_date = CURRENT_DATE AND a.attended = false),
                    COUNT(*) FILTER (WHERE s.slot_date = CURRENT_DATE + 1 AND a.status != 'cancelled'),
                    COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM s.slot_date) = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(WEEK FROM s.slot_date) = EXTRACT(WEEK FROM CURRENT_DATE) AND a.status != 'cancelled'),
                    COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM s.slot_date) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '7 days') AND EXTRACT(WEEK FROM s.slot_date) = EXTRACT(WEEK FROM CURRENT_DATE - INTERVAL '7 days') AND a.status != 'cancelled'),
                    COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM s.slot_date) = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM s.slot_date) = EXTRACT(MONTH FROM CURRENT_DATE) AND a.status != 'cancelled'),
                    COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM s.slot_date) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(MONTH FROM s.slot_date) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month') AND a.status != 'cancelled'),
                    COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM s.slot_date) = EXTRACT(YEAR FROM CURRENT_DATE) AND a.status != 'cancelled'),
                    COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM s.slot_date) = EXTRACT(YEAR FROM CURRENT_DATE) - 1 AND a.status != 'cancelled')
                 FROM appointments a
                 JOIN availability_slots s ON a.slot_id = s.id"
            )
            .fetch_one(&state.pool)
            .await
            .map_err(|e| AppError::Database(e))?
        };

    let total_appointments: i64 = if let Some(did) = doctor_id {
        sqlx::query_scalar("SELECT COUNT(*) FROM appointments WHERE doctor_id = $1")
            .bind(did)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| AppError::Database(e))?
    } else {
        sqlx::query_scalar("SELECT COUNT(*) FROM appointments")
            .fetch_one(&state.pool)
            .await
            .map_err(|e| AppError::Database(e))?
    };

    Ok(Json(DashboardStatsResponse {
        today_appointments,
        missed_today,
        tomorrow_appointments,
        this_week_appointments,
        last_week_appointments,
        this_month_appointments,
        last_month_appointments,
        this_year_appointments,
        last_year_appointments,
        total_appointments,
    }))
}

pub fn auth_routes() -> axum::Router<AppState> {
    Router::new()
        .route("/api/auth/request-otp", post(request_otp))
        .route("/api/auth/verify-otp", post(verify_otp_handler))
        .route("/api/auth/oauth/google", post(oauth_google_handler))
        .route("/api/auth/oauth/apple", post(oauth_apple_handler))
        .route("/api/auth/refresh", post(refresh_token_handler))
        .route("/api/auth/invalidate", post(invalidate_token_handler))
        .route("/api/auth/login", post(login_handler))
        .route("/api/auth/mfa/challenge", post(mfa_challenge_handler))
        .route("/api/auth/mfa/verify", post(mfa_verify_handler))
        .route("/api/auth/set-password", post(set_password_handler))
        .route("/api/auth/mfa-status", get(mfa_status_handler))
        .route("/api/auth/mfa", put(setup_mfa_handler))
        .route("/api/auth/forgot-password/init", post(forgot_password_init_handler))
        .route("/api/auth/forgot-password/verify", post(forgot_password_verify_handler))
        .route("/api/auth/forgot-password/reset", post(forgot_password_reset_handler))
        .route("/api/auth/profile", get(profile_handler))
        .route("/api/auth/dashboard-stats", get(dashboard_stats_handler))
}
