use axum::{
    Json, Router,
    extract::{Path, Query, State},
    routing::{delete, get, post},
};
use chrono::NaiveDate;
use serde::Deserialize;
use uuid::Uuid;

use crate::error::{AppError, validate_length};
use crate::middleware::auth::{AuthUser, require_role};
use crate::models::{AppointmentHistoryItem, DoctorUnavailability, DoctorUnavailabilityWithConflicts};
use crate::state::AppState;

#[derive(Deserialize)]
pub struct CreateUnavailabilityRequest {
    pub slot_date: String,
    pub end_date: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub reason: Option<String>,
}

#[derive(Deserialize)]
pub struct CheckUnavailabilityConflictsQuery {
    pub slot_date: String,
    pub end_date: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
}

pub async fn list_unavailability(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(doctor_id): Path<Uuid>,
) -> Result<Json<Vec<DoctorUnavailabilityWithConflicts>>, AppError> {
    if auth.role != "admin" && auth.role != "scheduler" {
        if auth.role == "doctor" {
            let did = sqlx::query_scalar::<_, Uuid>(
                "SELECT id FROM doctors WHERE email = $1"
            )
            .bind(&auth.sub)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| AppError::Database(e))?
            .ok_or_else(|| AppError::Unauthorized("Doctor profile not found".to_string()))?;
            if did != doctor_id {
                return Err(AppError::Unauthorized("You can only view your own unavailability".to_string()));
            }
        } else {
            require_role(&auth, &["admin", "scheduler", "doctor"])?;
        }
    }
    let rows = sqlx::query_as::<_, DoctorUnavailabilityWithConflicts>(
        "SELECT du.*, \
         (SELECT COUNT(*) FROM appointments a \
          JOIN availability_slots s ON s.id = a.slot_id \
          WHERE a.doctor_id = du.doctor_id \
            AND s.slot_date BETWEEN du.slot_date AND du.end_date \
            AND a.attended IS NULL \
            AND a.status != 'cancelled' \
            AND ((du.start_time IS NULL AND du.end_time IS NULL) \
                 OR (s.start_time < du.end_time AND s.end_time > du.start_time)) \
         ) AS conflict_count \
         FROM doctor_unavailability du \
         WHERE du.doctor_id = $1 \
         ORDER BY du.slot_date, du.start_time"
    )
    .bind(doctor_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    Ok(Json(rows))
}

pub async fn create_unavailability(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(doctor_id): Path<Uuid>,
    Json(body): Json<CreateUnavailabilityRequest>,
) -> Result<Json<DoctorUnavailabilityWithConflicts>, AppError> {
    state.check_mutation_rate_limit(&format!("create_unavailability:{}", auth.sub))?;

    if auth.role != "admin" && auth.role != "scheduler" {
        if auth.role == "doctor" {
            let did = sqlx::query_scalar::<_, Uuid>(
                "SELECT id FROM doctors WHERE email = $1"
            )
            .bind(&auth.sub)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| AppError::Database(e))?
            .ok_or_else(|| AppError::Unauthorized("Doctor profile not found".to_string()))?;
            if did != doctor_id {
                return Err(AppError::Unauthorized("You can only set your own unavailability".to_string()));
            }
        } else {
            require_role(&auth, &["admin", "scheduler", "doctor"])?;
        }
    }

    if let Some(ref reason) = body.reason {
        validate_length(reason, "Reason", 500)?;
    }
    let slot_date = NaiveDate::parse_from_str(&body.slot_date, "%Y-%m-%d")
        .map_err(|_| AppError::Validation("Invalid date format, use YYYY-MM-DD".to_string()))?;

    let end_date = match body.end_date {
        Some(ref d) => Some(
            NaiveDate::parse_from_str(d, "%Y-%m-%d")
                .map_err(|_| AppError::Validation("Invalid end_date format, use YYYY-MM-DD".to_string()))?
        ),
        None => None,
    };
    let end_date = end_date.unwrap_or(slot_date);

    if end_date < slot_date {
        return Err(AppError::Validation("end_date must be on or after start date".to_string()));
    }

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
        "INSERT INTO doctor_unavailability (doctor_id, slot_date, end_date, start_time, end_time, reason)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *"
    )
    .bind(doctor_id)
    .bind(slot_date)
    .bind(end_date)
    .bind(start_time)
    .bind(end_time)
    .bind(&reason)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    let conflict_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM appointments a \
         JOIN availability_slots s ON s.id = a.slot_id \
         WHERE a.doctor_id = $1 \
           AND s.slot_date BETWEEN $2 AND $3 \
           AND a.attended IS NULL \
           AND a.status != 'cancelled' \
           AND (($4 IS NULL AND $5 IS NULL) \
                OR (s.start_time < $5 AND s.end_time > $4))"
    )
    .bind(doctor_id)
    .bind(slot_date)
    .bind(end_date)
    .bind(start_time)
    .bind(end_time)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    let resp = DoctorUnavailabilityWithConflicts {
        id: record.id,
        doctor_id: record.doctor_id,
        slot_date: record.slot_date,
        end_date: record.end_date,
        start_time: record.start_time,
        end_time: record.end_time,
        reason: record.reason,
        created_at: record.created_at,
        conflict_count,
    };

    Ok(Json(resp))
}

pub async fn list_unavailability_conflicts(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((doctor_id, unavail_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Vec<AppointmentHistoryItem>>, AppError> {
    if auth.role != "admin" && auth.role != "scheduler" {
        if auth.role == "doctor" {
            let did = sqlx::query_scalar::<_, Uuid>(
                "SELECT id FROM doctors WHERE email = $1"
            )
            .bind(&auth.sub)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| AppError::Database(e))?
            .ok_or_else(|| AppError::Unauthorized("Doctor profile not found".to_string()))?;
            if did != doctor_id {
                return Err(AppError::Unauthorized("You can only view your own unavailability".to_string()));
            }
        } else {
            require_role(&auth, &["admin", "scheduler", "doctor"])?;
        }
    }

    let unavail = sqlx::query_as::<_, DoctorUnavailability>(
        "SELECT * FROM doctor_unavailability WHERE id = $1 AND doctor_id = $2"
    )
    .bind(unavail_id)
    .bind(doctor_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?
    .ok_or_else(|| AppError::NotFound("Unavailability record not found".to_string()))?;

    let appointments = sqlx::query_as::<_, AppointmentHistoryItem>(
        "SELECT a.id, a.patient_id, \
                p.first_name || ' ' || p.last_name AS patient_name, \
                p.email AS patient_email, p.phone AS patient_phone, \
                a.doctor_id, \
                d.first_name || ' ' || d.last_name AS doctor_name, \
                d.specialization, \
                s.slot_date, s.start_time, s.end_time, \
                a.status, a.notes, CASE WHEN a.attended IS NULL AND s.slot_date < CURRENT_DATE AND a.status != 'cancelled' THEN false ELSE a.attended END AS attended, a.minutes_late, a.cancellation_reason, \
                TRUE AS has_conflict \
         FROM appointments a \
         JOIN patients p ON p.id = a.patient_id \
         JOIN doctors d ON d.id = a.doctor_id \
         JOIN availability_slots s ON s.id = a.slot_id \
         WHERE a.doctor_id = $1 \
           AND s.slot_date BETWEEN $2 AND $3 \
           AND a.attended IS NULL \
           AND a.status != 'cancelled' \
           AND (($4 IS NULL AND $5 IS NULL) \
                OR (s.start_time < $5 AND s.end_time > $4))"
    )
    .bind(doctor_id)
    .bind(unavail.slot_date)
    .bind(unavail.end_date)
    .bind(unavail.start_time)
    .bind(unavail.end_time)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    Ok(Json(appointments))
}

pub async fn delete_unavailability(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((doctor_id, unavail_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<&'static str>, AppError> {
    state.check_mutation_rate_limit(&format!("delete_unavailability:{}", auth.sub))?;

    if auth.role != "admin" && auth.role != "scheduler" {
        if auth.role == "doctor" {
            let did = sqlx::query_scalar::<_, Uuid>(
                "SELECT id FROM doctors WHERE email = $1"
            )
            .bind(&auth.sub)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| AppError::Database(e))?
            .ok_or_else(|| AppError::Unauthorized("Doctor profile not found".to_string()))?;
            if did != doctor_id {
                return Err(AppError::Unauthorized("You can only delete your own unavailability".to_string()));
            }
        } else {
            require_role(&auth, &["admin", "scheduler", "doctor"])?;
        }
    }

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

pub async fn check_unavailability_conflicts(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(doctor_id): Path<Uuid>,
    Query(query): Query<CheckUnavailabilityConflictsQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    if auth.role != "admin" && auth.role != "scheduler" {
        if auth.role == "doctor" {
            let did = sqlx::query_scalar::<_, Uuid>(
                "SELECT id FROM doctors WHERE email = $1"
            )
            .bind(&auth.sub)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| AppError::Database(e))?
            .ok_or_else(|| AppError::Unauthorized("Doctor profile not found".to_string()))?;
            if did != doctor_id {
                return Err(AppError::Unauthorized("You can only check your own unavailability".to_string()));
            }
        } else {
            require_role(&auth, &["admin", "scheduler", "doctor"])?;
        }
    }

    let slot_date = NaiveDate::parse_from_str(&query.slot_date, "%Y-%m-%d")
        .map_err(|_| AppError::Validation("Invalid date format, use YYYY-MM-DD".to_string()))?;

    let end_date = match query.end_date {
        Some(ref d) => Some(
            NaiveDate::parse_from_str(d, "%Y-%m-%d")
                .map_err(|_| AppError::Validation("Invalid end_date format, use YYYY-MM-DD".to_string()))?
        ),
        None => None,
    };
    let end_date = end_date.unwrap_or(slot_date);

    if end_date < slot_date {
        return Err(AppError::Validation("end_date must be on or after start date".to_string()));
    }

    let start_time = match query.start_time {
        Some(ref t) => Some(
            chrono::NaiveTime::parse_from_str(t, "%H:%M")
                .map_err(|_| AppError::Validation("Invalid start_time format, use HH:MM".to_string()))?
        ),
        None => None,
    };

    let end_time = match query.end_time {
        Some(ref t) => Some(
            chrono::NaiveTime::parse_from_str(t, "%H:%M")
                .map_err(|_| AppError::Validation("Invalid end_time format, use HH:MM".to_string()))?
        ),
        None => None,
    };

    let conflict_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM appointments a \
         JOIN availability_slots s ON s.id = a.slot_id \
         WHERE a.doctor_id = $1 \
           AND s.slot_date BETWEEN $2 AND $3 \
           AND a.attended IS NULL \
           AND a.status != 'cancelled' \
           AND (($4 IS NULL AND $5 IS NULL) \
                OR (s.start_time < $5 AND s.end_time > $4))"
    )
    .bind(doctor_id)
    .bind(slot_date)
    .bind(end_date)
    .bind(start_time)
    .bind(end_time)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    Ok(Json(serde_json::json!({ "conflict_count": conflict_count })))
}

pub async fn get_unavailability_conflict_summary(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(doctor_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    if auth.role != "admin" && auth.role != "scheduler" {
        if auth.role == "doctor" {
            let did = sqlx::query_scalar::<_, Uuid>(
                "SELECT id FROM doctors WHERE email = $1"
            )
            .bind(&auth.sub)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| AppError::Database(e))?
            .ok_or_else(|| AppError::Unauthorized("Doctor profile not found".to_string()))?;
            if did != doctor_id {
                return Err(AppError::Unauthorized("Unauthorized".to_string()));
            }
        } else {
            require_role(&auth, &["admin", "scheduler", "doctor"])?;
        }
    }

    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM appointments a \
         JOIN availability_slots s ON s.id = a.slot_id \
         WHERE a.doctor_id = $1 \
           AND a.attended IS NULL \
           AND a.status != 'cancelled' \
           AND EXISTS ( \
             SELECT 1 FROM doctor_unavailability du \
             WHERE du.doctor_id = a.doctor_id \
               AND s.slot_date BETWEEN du.slot_date AND du.end_date \
               AND ((du.start_time IS NULL AND du.end_time IS NULL) \
                    OR (s.start_time < du.end_time AND s.end_time > du.start_time)) \
           )"
    )
    .bind(doctor_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    Ok(Json(serde_json::json!({ "total_conflicts": total })))
}

pub fn unavailability_routes() -> Router<AppState> {
    Router::new()
        .route("/api/doctors/:id/unavailability", get(list_unavailability))
        .route("/api/doctors/:id/unavailability", post(create_unavailability))
        .route("/api/doctors/:id/unavailability/:unavail_id", delete(delete_unavailability))
        .route("/api/doctors/:id/unavailability/:unavail_id/conflicts", get(list_unavailability_conflicts))
        .route("/api/doctors/:id/unavailability/check-conflicts", get(check_unavailability_conflicts))
        .route("/api/doctors/:id/unavailability/conflict-summary", get(get_unavailability_conflict_summary))
}
