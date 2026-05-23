use axum::{Json, extract::{Path, State}, Router, routing::{get, patch, post}};
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
    pub patient_id: Option<Uuid>,
}

#[derive(Deserialize)]
pub struct UpdateAppointmentRequest {
    pub slot_id: Option<Uuid>,
    pub doctor_id: Option<Uuid>,
    pub status: Option<String>,
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
    let patient = if let Some(pid) = body.patient_id {
        sqlx::query_as::<_, crate::models::Patient>(
            "SELECT * FROM patients WHERE id = $1"
        )
        .bind(pid)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| AppError::Database(e))?
        .ok_or_else(|| AppError::BadRequest("Patient profile not found".to_string()))?
    } else {
        get_patient_from_auth(&state, &_auth).await?
    };

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

pub async fn update_appointment(
    State(state): State<AppState>,
    _auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateAppointmentRequest>,
) -> Result<Json<AppointmentResponse>, AppError> {
    let patient = get_patient_from_auth(&state, &_auth).await?;

    let appointment = sqlx::query_as::<_, Appointment>(
        "SELECT * FROM appointments WHERE id = $1 AND patient_id = $2 AND status = 'confirmed'"
    )
    .bind(id)
    .bind(patient.id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?
    .ok_or_else(|| AppError::NotFound("Appointment not found or already cancelled".to_string()))?;

    if let Some(new_slot_id) = body.slot_id {
        let new_slot = sqlx::query_as::<_, crate::models::AvailabilitySlot>(
            "SELECT * FROM availability_slots WHERE id = $1 AND is_booked = FALSE FOR UPDATE"
        )
        .bind(new_slot_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| AppError::Database(e))?
        .ok_or_else(|| AppError::BadRequest("Slot is not available or already booked".to_string()))?;

        let doctor_id = body.doctor_id.unwrap_or(new_slot.doctor_id);

        if let Some(req_doctor_id) = body.doctor_id {
            if req_doctor_id != new_slot.doctor_id {
                return Err(AppError::BadRequest("Selected slot does not belong to the specified doctor".to_string()));
            }
        }

        let existing = sqlx::query_as::<_, (chrono::NaiveTime, chrono::NaiveDate)>(
            "SELECT s.start_time, s.slot_date
             FROM appointments a
             JOIN availability_slots s ON s.id = a.slot_id
             WHERE a.patient_id = $1 AND a.status = 'confirmed' AND s.slot_date = $2 AND a.id != $3"
        )
        .bind(patient.id)
        .bind(new_slot.slot_date)
        .bind(id)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| AppError::Database(e))?;

        for (existing_time, _) in &existing {
            let diff = (new_slot.start_time - *existing_time).num_minutes().abs();
            if diff < state.min_gap_minutes {
                return Err(AppError::BadRequest(
                    format!("You already have an appointment at {} on {}. There must be at least {} minutes between appointments.", existing_time.format("%H:%M"), new_slot.slot_date, state.min_gap_minutes)
                ));
            }
        }

        let updated = sqlx::query_as::<_, Appointment>(
            "WITH old_slot AS (
                SELECT slot_id FROM appointments WHERE id = $1
            ),
            freed AS (
                UPDATE availability_slots SET is_booked = FALSE WHERE id = (SELECT slot_id FROM old_slot)
            ),
            booked AS (
                UPDATE availability_slots SET is_booked = TRUE WHERE id = $2
            )
            UPDATE appointments SET slot_id = $2, doctor_id = $3, updated_at = NOW() WHERE id = $1
            RETURNING *"
        )
        .bind(id)
        .bind(new_slot_id)
        .bind(doctor_id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| AppError::Database(e))?;

        return Ok(Json(AppointmentResponse {
            id: updated.id,
            patient_id: updated.patient_id,
            doctor_id: updated.doctor_id,
            slot_id: updated.slot_id,
            status: updated.status,
            created_at: updated.created_at,
        }));
    }

    if let Some(new_status) = &body.status {
        if new_status == "cancelled" {
            let updated = sqlx::query_as::<_, Appointment>(
                "WITH cancelled AS (
                    UPDATE appointments SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *
                ),
                freed AS (
                    UPDATE availability_slots SET is_booked = FALSE WHERE id = (SELECT slot_id FROM cancelled)
                )
                SELECT id, patient_id, doctor_id, slot_id, status, created_at, updated_at FROM cancelled"
            )
            .bind(id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| AppError::Database(e))?;

            return Ok(Json(AppointmentResponse {
                id: updated.id,
                patient_id: updated.patient_id,
                doctor_id: updated.doctor_id,
                slot_id: updated.slot_id,
                status: updated.status,
                created_at: updated.created_at,
            }));
        }
    }

    Err(AppError::BadRequest("No valid update provided".to_string()))
}

async fn get_patient_from_auth(
    state: &AppState,
    auth: &AuthUser,
) -> Result<crate::models::Patient, AppError> {
    let patient = if auth.sub.contains('@') {
        sqlx::query_as::<_, crate::models::Patient>(
            "SELECT * FROM patients WHERE email = $1"
        )
        .bind(&auth.sub)
        .fetch_optional(&state.pool)
        .await
    } else {
        sqlx::query_as::<_, crate::models::Patient>(
            "SELECT * FROM patients WHERE phone = $1"
        )
        .bind(&auth.sub)
        .fetch_optional(&state.pool)
        .await
    }
    .map_err(|e| AppError::Database(e))?
    .ok_or_else(|| AppError::BadRequest("Patient profile not found".to_string()))?;

    Ok(patient)
}

pub fn appointment_routes() -> Router<AppState> {
    Router::new()
        .route("/api/appointments", post(create_appointment))
        .route("/api/appointments/:id", get(get_appointment))
        .route("/api/appointments/:id", patch(update_appointment))
}
