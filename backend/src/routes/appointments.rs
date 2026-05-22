use axum::{Json, extract::{Path, State}, Router, routing::{get, post}};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::AuthUser;
use crate::models::Appointment;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct CreateAppointmentRequest {
    pub doctor_id: Option<Uuid>,
    pub slot_id: Uuid,
}

#[derive(Serialize)]
pub struct AppointmentResponse {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub doctor_id: Uuid,
    pub slot_id: Uuid,
    pub status: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub async fn create_appointment(
    State(state): State<AppState>,
    _auth: AuthUser,
    Json(body): Json<CreateAppointmentRequest>,
) -> Result<Json<AppointmentResponse>, AppError> {
    let patient = if _auth.sub.contains('@') {
        sqlx::query_as::<_, crate::models::Patient>(
            "SELECT * FROM patients WHERE email = $1"
        )
        .bind(&_auth.sub)
        .fetch_optional(&state.pool)
        .await
    } else {
        sqlx::query_as::<_, crate::models::Patient>(
            "SELECT * FROM patients WHERE phone = $1"
        )
        .bind(&_auth.sub)
        .fetch_optional(&state.pool)
        .await
    }
    .map_err(|e| AppError::Database(e))?
    .ok_or_else(|| AppError::BadRequest("Patient profile not found. Please create your profile first.".to_string()))?;

    let slot = sqlx::query_as::<_, crate::models::AvailabilitySlot>(
        "SELECT * FROM availability_slots WHERE id = $1 AND is_booked = FALSE FOR UPDATE"
    )
    .bind(body.slot_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?
    .ok_or_else(|| AppError::BadRequest("Slot is not available or already booked".to_string()))?;

    let existing = sqlx::query_as::<_, (chrono::NaiveTime, chrono::NaiveDate)>(
        "SELECT s.start_time, s.slot_date
         FROM appointments a
         JOIN availability_slots s ON s.id = a.slot_id
         WHERE a.patient_id = $1 AND a.status = 'confirmed' AND s.slot_date = $2"
    )
    .bind(patient.id)
    .bind(slot.slot_date)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    for (existing_time, _) in &existing {
        let diff = (slot.start_time - *existing_time).num_minutes().abs();
        if diff < state.min_gap_minutes {
            return Err(AppError::BadRequest(
                format!("You already have an appointment at {} on {}. There must be at least {} minutes between appointments.", existing_time.format("%H:%M"), slot.slot_date, state.min_gap_minutes)
            ));
        }
    }

    let doctor_id = body.doctor_id.unwrap_or(slot.doctor_id);

    if let Some(req_doctor_id) = body.doctor_id {
        if req_doctor_id != slot.doctor_id {
            return Err(AppError::BadRequest("Selected slot does not belong to the specified doctor".to_string()));
        }
    }

    let appointment = sqlx::query_as::<_, Appointment>(
        "WITH booked_slot AS (
            UPDATE availability_slots SET is_booked = TRUE WHERE id = $1 RETURNING *
        )
        INSERT INTO appointments (patient_id, doctor_id, slot_id)
        VALUES ($2, $3, $1)
        RETURNING *"
    )
    .bind(body.slot_id)
    .bind(patient.id)
    .bind(doctor_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    Ok(Json(AppointmentResponse {
        id: appointment.id,
        patient_id: appointment.patient_id,
        doctor_id: appointment.doctor_id,
        slot_id: appointment.slot_id,
        status: appointment.status,
        created_at: appointment.created_at,
    }))
}

pub async fn get_appointment(
    State(state): State<AppState>,
    _auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<AppointmentResponse>, AppError> {
    let appointment = sqlx::query_as::<_, Appointment>(
        "SELECT * FROM appointments WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?
    .ok_or_else(|| AppError::NotFound("Appointment not found".to_string()))?;

    Ok(Json(AppointmentResponse {
        id: appointment.id,
        patient_id: appointment.patient_id,
        doctor_id: appointment.doctor_id,
        slot_id: appointment.slot_id,
        status: appointment.status,
        created_at: appointment.created_at,
    }))
}

pub fn appointment_routes() -> Router<AppState> {
    Router::new()
        .route("/api/appointments", post(create_appointment))
        .route("/api/appointments/:id", get(get_appointment))
}
