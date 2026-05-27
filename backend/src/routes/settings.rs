use axum::{
    Json, extract::{Path, State}, Router, routing::get,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;
use crate::services::generate_slots;
use crate::state::AppState;

#[derive(Serialize)]
pub struct SettingResponse {
    pub id: Uuid,
    pub group_name: String,
    pub name: String,
    pub value: String,
    pub is_sensitive: bool,
    pub description: String,
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

    Ok(Json(SettingResponse {
        id: setting.id,
        group_name: setting.group_name,
        name: setting.name,
        value: setting.value.unwrap_or_default(),
        is_sensitive: setting.is_sensitive,
        description: setting.description,
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
        .map(|s| SettingResponse {
            id: s.id,
            group_name: s.group_name,
            name: s.name,
            value: s.value.unwrap_or_default(),
            is_sensitive: s.is_sensitive,
            description: s.description,
        })
        .collect();

    Ok(Json(response))
}

pub async fn update_setting(
    State(state): State<AppState>,
    Path((group, name)): Path<(String, String)>,
    Json(body): Json<UpdateSettingRequest>,
) -> Result<Json<SettingResponse>, AppError> {
    // Verify the setting exists
    let existing = state.settings.get_setting(&group, &name).await?
        .ok_or_else(|| AppError::NotFound(format!("Setting '{}/{}' not found", group, name)))?;

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

    // Update in-memory state and regenerate slots if appointment setting changed
    if group == "appointment" {
        match name.as_str() {
            "min_advance_days" => {
                if let Ok(v) = body.value.parse::<i64>() {
                    *state.min_advance_days.write().unwrap() = v;
                }
            }
            "min_gap_minutes" => {
                if let Ok(v) = body.value.parse::<i64>() {
                    *state.min_gap_minutes.write().unwrap() = v;
                }
            }
            "max_upcoming_appointments" => {
                if let Ok(v) = body.value.parse::<i64>() {
                    *state.max_upcoming_appointments.write().unwrap() = v;
                }
            }
            "clinic_name" => {
                *state.clinic_name.write().unwrap() = body.value.clone();
            }
            "clinic_address" => {
                *state.clinic_address.write().unwrap() = body.value.clone();
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

    Ok(Json(SettingResponse {
        id: existing.id,
        group_name: group,
        name,
        value: body.value,
        is_sensitive: existing.is_sensitive,
        description: existing.description,
    }))
}

pub fn settings_routes() -> Router<AppState> {
    Router::new()
        .route("/api/settings/:group/:name", get(get_setting).put(update_setting))
        .route("/api/settings/:group", get(get_settings_group))
}
