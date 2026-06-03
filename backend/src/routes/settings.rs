use std::net::{Ipv4Addr, Ipv6Addr};

use axum::{
    Json, extract::{Path, State}, Router, routing::get,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{AppError, validate_length};
use crate::middleware::auth::{require_role, AuthUser};
use crate::services::generate_slots;
use crate::state::AppState;

fn validate_setting_value(value_type: &str, value: &str) -> Result<(), AppError> {
    if value.is_empty() {
        return Ok(());
    }
    match value_type {
        "integer" => {
            value.parse::<i64>().map_err(|_| {
                AppError::Validation("Value must be a valid integer".into())
            })?;
        }
        "double" => {
            value.parse::<f64>().map_err(|_| {
                AppError::Validation("Value must be a valid number".into())
            })?;
        }
        "time" => {
            let parts: Vec<&str> = value.split(':').collect();
            if parts.len() != 2
                || parts[0].len() != 2 || parts[1].len() != 2
                || !parts[0].chars().all(|c| c.is_ascii_digit())
                || !parts[1].chars().all(|c| c.is_ascii_digit())
            {
                return Err(AppError::Validation("Value must be in HH:MM format (24-hour)".into()));
            }
            let h: u8 = parts[0].parse().unwrap_or(99);
            let m: u8 = parts[1].parse().unwrap_or(99);
            if h > 23 || m > 59 {
                return Err(AppError::Validation("Value must be in HH:MM format (24-hour)".into()));
            }
        }
        "date" => {
            let parts: Vec<&str> = value.split('-').collect();
            if parts.len() != 3
                || parts[0].len() != 4 || parts[1].len() != 2 || parts[2].len() != 2
                || !parts.iter().all(|p| p.chars().all(|c| c.is_ascii_digit()))
            {
                return Err(AppError::Validation("Value must be in YYYY-MM-DD format".into()));
            }
            let y: i32 = parts[0].parse().unwrap_or(0);
            let m: u32 = parts[1].parse().unwrap_or(0);
            let d: u32 = parts[2].parse().unwrap_or(0);
            if chrono::NaiveDate::from_ymd_opt(y, m, d).is_none() {
                return Err(AppError::Validation("Value must be a valid date in YYYY-MM-DD format".into()));
            }
        }
        "datetime" => {
            if chrono::NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M:%S").is_err()
                && chrono::NaiveDateTime::parse_from_str(value, "%Y-%m-%d %H:%M:%S").is_err()
            {
                return Err(AppError::Validation("Value must be in YYYY-MM-DD HH:MM:SS or YYYY-MM-DDTHH:MM:SS format".into()));
            }
        }
        "email" => {
            if !value.contains('@') || !value.contains('.') {
                return Err(AppError::Validation("Value must be a valid email address".into()));
            }
        }
        "url" => {
            if !value.starts_with("http://") && !value.starts_with("https://") {
                return Err(AppError::Validation("Value must start with http:// or https://".into()));
            }
        }
        "ipv4" => {
            value.parse::<Ipv4Addr>().map_err(|_| {
                AppError::Validation("Value must be a valid IPv4 address".into())
            })?;
        }
        "ipv6" => {
            value.parse::<Ipv6Addr>().map_err(|_| {
                AppError::Validation("Value must be a valid IPv6 address".into())
            })?;
        }
        "phone" => {
            let cleaned: String = value.chars().filter(|c| c.is_ascii_digit() || *c == '+' || *c == '-' || *c == ' ' || *c == '(' || *c == ')').collect();
            if cleaned.len() != value.len() || value.chars().filter(|c| c.is_ascii_digit()).count() < 5 {
                return Err(AppError::Validation("Value must be a valid phone number".into()));
            }
        }
        _ => {}
    }
    Ok(())
}

#[derive(Serialize)]
pub struct SettingResponse {
    pub id: Uuid,
    pub group_name: String,
    pub name: String,
    pub value: String,
    pub is_sensitive: bool,
    pub description: String,
    pub value_type: String,
}

#[derive(Deserialize)]
pub struct UpdateSettingRequest {
    pub value: String,
}

pub async fn get_setting(
    State(state): State<AppState>,
    Path((group, name)): Path<(String, String)>,
) -> Result<Json<SettingResponse>, AppError> {
    let setting = state.settings.get_setting(&group, &name).await?
        .ok_or_else(|| AppError::NotFound(format!("Setting '{}/{}' not found", group, name)))?;

    let value = if setting.is_sensitive {
        "********".to_string()
    } else {
        setting.value.unwrap_or_default()
    };

    Ok(Json(SettingResponse {
        id: setting.id,
        group_name: setting.group_name,
        name: setting.name,
        value,
        is_sensitive: setting.is_sensitive,
        description: setting.description,
        value_type: setting.value_type,
    }))
}

pub async fn get_settings_group(
    State(state): State<AppState>,
    Path(group): Path<String>,
) -> Result<Json<Vec<SettingResponse>>, AppError> {
    let settings = state.settings.get_group(&group).await?;
    if settings.is_empty() {
        return Err(AppError::NotFound(format!("Settings group '{}' not found", group)));
    }

    let response: Vec<SettingResponse> = settings
        .into_iter()
        .map(|s| {
            let value = if s.is_sensitive {
                "********".to_string()
            } else {
                s.value.unwrap_or_default()
            };
            SettingResponse {
                id: s.id,
                group_name: s.group_name,
                name: s.name,
                value,
                is_sensitive: s.is_sensitive,
                description: s.description,
                value_type: s.value_type,
            }
        })
        .collect();

    Ok(Json(response))
}

pub async fn update_setting(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((group, name)): Path<(String, String)>,
    Json(body): Json<UpdateSettingRequest>,
) -> Result<Json<SettingResponse>, AppError> {
    state.check_mutation_rate_limit(&format!("update_setting:{}", auth.sub))?;
    require_role(&auth, &["admin"])?;
    validate_length(&body.value, "Setting value", 10000)?;
    let existing = state.settings.get_setting(&group, &name).await?
        .ok_or_else(|| AppError::NotFound(format!("Setting '{}/{}' not found", group, name)))?;

    validate_setting_value(&existing.value_type, &body.value)?;

    let new_value = if existing.is_sensitive {
        state.settings.encrypt(&body.value)
    } else {
        body.value.clone()
    };

    sqlx::query(
        "UPDATE settings SET value = $1 WHERE group_name = $2 AND name = $3"
    )
    .bind(&new_value)
    .bind(&group)
    .bind(&name)
    .execute(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    if group == "appointment" {
        match name.as_str() {
            "min_advance_days" => {
                if let Ok(v) = body.value.parse::<i64>() {
                    state.set_min_advance_days(v);
                }
            }
            "min_gap_minutes" => {
                if let Ok(v) = body.value.parse::<i64>() {
                    state.set_min_gap_minutes(v);
                }
            }
            "max_upcoming_appointments" => {
                if let Ok(v) = body.value.parse::<i64>() {
                    state.set_max_upcoming_appointments(v);
                }
            }
            _ => {}
        }

        let bg_pool = state.pool.clone();
        let bg_settings = state.settings.clone();
        tokio::spawn(async move {
            if let Err(e) = generate_slots(&bg_pool, &bg_settings).await {
                tracing::error!("Slot regeneration after settings update failed: {:?}", e);
            }
        });
    }

    if group == "clinic" {
        match name.as_str() {
            "clinic_name" => {
                state.set_clinic_name(body.value.clone());
            }
            "clinic_address" => {
                state.set_clinic_address(body.value.clone());
            }
            _ => {}
        }
    }

    let response_value = if existing.is_sensitive {
        "********".to_string()
    } else {
        body.value
    };

    Ok(Json(SettingResponse {
        id: existing.id,
        group_name: group,
        name,
        value: response_value,
        is_sensitive: existing.is_sensitive,
        description: existing.description,
        value_type: existing.value_type,
    }))
}

pub fn settings_routes() -> Router<AppState> {
    Router::new()
        .route("/api/settings/:group/:name", get(get_setting).put(update_setting))
        .route("/api/settings/:group", get(get_settings_group))
}
