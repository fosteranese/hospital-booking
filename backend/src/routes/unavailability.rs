use axum::{
    Json, Router,
    extract::{Path, State},
    routing::{delete, get, post},
};
use chrono::NaiveDate;
use serde::Deserialize;
use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::AuthUser;
use crate::models::DoctorUnavailability;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct CreateUnavailabilityRequest {
    pub slot_date: String,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub reason: Option<String>,
}

pub async fn list_unavailability(
    State(state): State<AppState>,
    _auth: AuthUser,
    Path(doctor_id): Path<Uuid>,
) -> Result<Json<Vec<DoctorUnavailability>>, AppError> {
    let rows = sqlx::query_as::<_, DoctorUnavailability>(
        "SELECT * FROM doctor_unavailability WHERE doctor_id = $1 ORDER BY slot_date, start_time"
    )
    .bind(doctor_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    Ok(Json(rows))
}

pub async fn create_unavailability(
    State(state): State<AppState>,
    _auth: AuthUser,
    Path(doctor_id): Path<Uuid>,
    Json(body): Json<CreateUnavailabilityRequest>,
) -> Result<Json<DoctorUnavailability>, AppError> {
    let slot_date = NaiveDate::parse_from_str(&body.slot_date, "%Y-%m-%d")
        .map_err(|_| AppError::Validation("Invalid date format, use YYYY-MM-DD".to_string()))?;

    let start_time = match body.start_time {
        Some(ref t) => Some(
            chrono::NaiveTime::parse_from_str(t, "%H:%M")
                .map_err(|_| AppError::Validation("Invalid start_time format, use HH:MM".to_string()))?
        ),
        None => None,
    };

    let end_time = match body.end_time {
        Some(ref t) => Some(
            chrono::NaiveTime::parse_from_str(t, "%H:%M")
                .map_err(|_| AppError::Validation("Invalid end_time format, use HH:MM".to_string()))?
        ),
        None => None,
    };

    // Validate: both or neither
    match (&start_time, &end_time) {
        (Some(_), None) | (None, Some(_)) => {
            return Err(AppError::Validation(
                "Both start_time and end_time must be provided together for a time range, or neither for a full-day off".to_string()
            ));
        }
        _ => {}
    }

    // Validate time range
    if let (Some(st), Some(et)) = (&start_time, &end_time) {
        if st >= et {
            return Err(AppError::Validation("start_time must be before end_time".to_string()));
        }
    }

    let reason = body.reason.unwrap_or_default();

    let record = sqlx::query_as::<_, DoctorUnavailability>(
        "INSERT INTO doctor_unavailability (doctor_id, slot_date, start_time, end_time, reason)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *"
    )
    .bind(doctor_id)
    .bind(slot_date)
    .bind(start_time)
    .bind(end_time)
    .bind(&reason)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    Ok(Json(record))
}

pub async fn delete_unavailability(
    State(state): State<AppState>,
    _auth: AuthUser,
    Path((doctor_id, unavail_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<&'static str>, AppError> {
    let result = sqlx::query(
        "DELETE FROM doctor_unavailability WHERE id = $1 AND doctor_id = $2"
    )
    .bind(unavail_id)
    .bind(doctor_id)
    .execute(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Unavailability record not found".to_string()));
    }

    Ok(Json("deleted"))
}

pub fn unavailability_routes() -> Router<AppState> {
    Router::new()
        .route("/api/doctors/:id/unavailability", get(list_unavailability))
        .route("/api/doctors/:id/unavailability", post(create_unavailability))
        .route("/api/doctors/:id/unavailability/:unavail_id", delete(delete_unavailability))
}
