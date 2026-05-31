use axum::{Json, extract::{Path, State}, Router, routing::{get, patch, post}};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{AppError, validate_length};
use crate::middleware::auth::AuthUser;
use crate::routes::patients::normalize_phone_or_raw;
use crate::models::Appointment;
use crate::state::AppState;

async fn check_slot_unavailability_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    doctor_id: Uuid,
    slot_date: chrono::NaiveDate,
    start_time: chrono::NaiveTime,
) -> Result<(), AppError> {
    let unavail = sqlx::query_as::<_, crate::models::DoctorUnavailability>(
        "SELECT * FROM doctor_unavailability WHERE doctor_id = $1 AND slot_date = $2"
    )
    .bind(doctor_id)
    .bind(slot_date)
    .fetch_all(&mut **tx)
    .await
    .map_err(|e| AppError::Database(e))?;

    for u in &unavail {
        if u.start_time.is_none() && u.end_time.is_none() {
            return Err(AppError::BadRequest(
                "This doctor is not available on the selected date".to_string()
            ));
        }
        if let (Some(st), Some(et)) = (u.start_time, u.end_time) {
            if start_time >= st && start_time < et {
                return Err(AppError::BadRequest(
                    format!("The doctor is unavailable at {} on this date", start_time.format("%H:%M"))
                ));
            }
        }
    }
    Ok(())
}

#[derive(Deserialize)]
pub struct CreateAppointmentRequest {
    pub doctor_id: Option<Uuid>,
    pub slot_id: Uuid,
    pub patient_id: Option<Uuid>,
    pub notes: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateAppointmentRequest {
    pub slot_id: Option<Uuid>,
    pub doctor_id: Option<Uuid>,
    pub status: Option<String>,
    pub attended: Option<bool>,
    pub cancellation_reason: Option<String>,
}

#[derive(Serialize)]
pub struct AppointmentResponse {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub doctor_id: Uuid,
    pub slot_id: Uuid,
    pub status: String,
    pub notes: String,
    pub attended: Option<bool>,
    pub cancellation_reason: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub async fn create_appointment(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreateAppointmentRequest>,
) -> Result<Json<AppointmentResponse>, AppError> {
    state.check_mutation_rate_limit(&format!("create_appointment:{}", auth.sub))?;

    if let Some(ref notes) = body.notes {
        validate_length(notes, "Notes", 1000)?;
    }

    let mut tx = state.pool.begin().await.map_err(|e| AppError::Database(e))?;

    let patient = if let Some(pid) = body.patient_id {
        sqlx::query_as::<_, crate::models::Patient>(
            "SELECT * FROM patients WHERE id = $1 FOR UPDATE"
        )
        .bind(pid)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| AppError::Database(e))?
        .ok_or_else(|| AppError::BadRequest("Patient profile not found".to_string()))?
    } else {
        let lookup = normalize_phone_or_raw(&auth.sub);
        if lookup.contains('@') {
            sqlx::query_as::<_, crate::models::Patient>(
                "SELECT * FROM patients WHERE email = $1 FOR UPDATE"
            )
            .bind(&lookup)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| AppError::Database(e))?
            .ok_or_else(|| AppError::BadRequest("Patient profile not found".to_string()))?
        } else {
            sqlx::query_as::<_, crate::models::Patient>(
                "SELECT * FROM patients WHERE phone = $1 FOR UPDATE"
            )
            .bind(&lookup)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| AppError::Database(e))?
            .ok_or_else(|| AppError::BadRequest("Patient profile not found".to_string()))?
        }
    };

    let upcoming_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM appointments a
         JOIN availability_slots s ON s.id = a.slot_id
         WHERE a.patient_id = $1 AND a.status = 'confirmed' AND s.slot_date >= CURRENT_DATE"
    )
    .bind(patient.id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Database(e))?;

    let max_upcoming = state.max_upcoming_appointments();
    if upcoming_count >= max_upcoming {
        tx.rollback().await.map_err(|e| AppError::Database(e))?;
        return Err(AppError::BadRequest(
            format!("You can only have up to {} upcoming appointments at a time. Please cancel or reschedule an existing appointment.", max_upcoming)
        ));
    }

    let slot = sqlx::query_as::<_, crate::models::AvailabilitySlot>(
        "SELECT * FROM availability_slots WHERE id = $1 AND is_booked = FALSE FOR UPDATE"
    )
    .bind(body.slot_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Database(e))?
    .ok_or_else(|| {
        AppError::BadRequest("Slot is not available or already booked".to_string())
    })?;

    let existing = sqlx::query_as::<_, (chrono::NaiveTime, chrono::NaiveDate)>(
        "SELECT s.start_time, s.slot_date
         FROM appointments a
         JOIN availability_slots s ON s.id = a.slot_id
         WHERE a.patient_id = $1 AND a.status = 'confirmed' AND s.slot_date = $2"
    )
    .bind(patient.id)
    .bind(slot.slot_date)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| AppError::Database(e))?;

    for (existing_time, _) in &existing {
            let diff = (slot.start_time - *existing_time).num_minutes().abs();
        let min_gap = state.min_gap_minutes();
        if diff < min_gap {
            tx.rollback().await.map_err(|e| AppError::Database(e))?;
            return Err(AppError::BadRequest(
                format!("You already have an appointment at {} on {}. There must be at least {} minutes between appointments.", existing_time.format("%H:%M"), slot.slot_date, min_gap)
            ));
        }
    }

    let today = chrono::Utc::now().date_naive();
    let min_advance = state.min_advance_days();
    if slot.slot_date < today + chrono::Duration::days(min_advance) {
        tx.rollback().await.map_err(|e| AppError::Database(e))?;
        return Err(AppError::BadRequest(
            format!("Appointments must be booked at least {} days in advance. The selected date is too soon.", min_advance)
        ));
    }

    let doctor_id = body.doctor_id.unwrap_or(slot.doctor_id);

    if let Some(req_doctor_id) = body.doctor_id {
        if req_doctor_id != slot.doctor_id {
            tx.rollback().await.map_err(|e| AppError::Database(e))?;
            return Err(AppError::BadRequest("Selected slot does not belong to the specified doctor".to_string()));
        }
    }

    check_slot_unavailability_in_tx(&mut tx, slot.doctor_id, slot.slot_date, slot.start_time).await?;

    let notes = body.notes.unwrap_or_default();

    let appointment = sqlx::query_as::<_, Appointment>(
        "WITH booked_slot AS (
            UPDATE availability_slots SET is_booked = TRUE WHERE id = $1 RETURNING *
        )
        INSERT INTO appointments (patient_id, doctor_id, slot_id, notes)
        VALUES ($2, $3, $1, $4)
        RETURNING *"
    )
    .bind(body.slot_id)
    .bind(patient.id)
    .bind(doctor_id)
    .bind(&notes)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Database(e))?;

    tx.commit().await.map_err(|e| AppError::Database(e))?;

    if let Err(e) = send_confirmation_email(&state, &patient, &appointment, &slot, &doctor_id).await {
        tracing::warn!("Failed to send confirmation email: {}", e);
    }

    Ok(Json(AppointmentResponse {
        id: appointment.id,
        patient_id: appointment.patient_id,
        doctor_id: appointment.doctor_id,
        slot_id: appointment.slot_id,
        status: appointment.status,
        notes: appointment.notes,
        attended: appointment.attended,
        cancellation_reason: appointment.cancellation_reason,
        created_at: appointment.created_at,
    }))
}

pub async fn get_appointment(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<AppointmentResponse>, AppError> {
    let appointment = if auth.role == "admin" || auth.role == "scheduler" {
        sqlx::query_as::<_, Appointment>(
            "SELECT * FROM appointments WHERE id = $1"
        )
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| AppError::Database(e))?
        .ok_or_else(|| AppError::NotFound("Appointment not found".to_string()))?
    } else {
        let patient = get_patient_from_auth(&state, &auth).await?;
        sqlx::query_as::<_, Appointment>(
            "SELECT * FROM appointments WHERE id = $1 AND patient_id = $2"
        )
        .bind(id)
        .bind(patient.id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| AppError::Database(e))?
        .ok_or_else(|| AppError::NotFound("Appointment not found".to_string()))?
    };

    Ok(Json(AppointmentResponse {
        id: appointment.id,
        patient_id: appointment.patient_id,
        doctor_id: appointment.doctor_id,
        slot_id: appointment.slot_id,
        status: appointment.status,
        notes: appointment.notes,
        attended: appointment.attended,
        cancellation_reason: appointment.cancellation_reason,
        created_at: appointment.created_at,
    }))
}

pub async fn update_appointment(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateAppointmentRequest>,
) -> Result<Json<AppointmentResponse>, AppError> {
    state.check_mutation_rate_limit(&format!("update_appointment:{}", auth.sub))?;

    if let Some(ref reason) = body.cancellation_reason {
        validate_length(reason, "Cancellation reason", 500)?;
    }
    let mut tx = state.pool.begin().await.map_err(|e| AppError::Database(e))?;
    let patient = get_patient_from_auth(&state, &auth).await?;

    let _appointment = sqlx::query_as::<_, Appointment>(
        "SELECT * FROM appointments WHERE id = $1 AND patient_id = $2 AND status = 'confirmed'"
    )
    .bind(id)
    .bind(patient.id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Database(e))?
    .ok_or_else(|| AppError::NotFound("Appointment not found or already cancelled".to_string()))?;

    if let Some(new_slot_id) = body.slot_id {
        let new_slot = sqlx::query_as::<_, crate::models::AvailabilitySlot>(
            "SELECT * FROM availability_slots WHERE id = $1 AND is_booked = FALSE FOR UPDATE"
        )
        .bind(new_slot_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| AppError::Database(e))?
        .ok_or_else(|| AppError::BadRequest("Slot is not available or already booked".to_string()))?;

        let upcoming_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM appointments a
             JOIN availability_slots s ON s.id = a.slot_id
             WHERE a.patient_id = $1 AND a.status = 'confirmed' AND s.slot_date >= CURRENT_DATE AND a.id != $2"
        )
        .bind(patient.id)
        .bind(id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::Database(e))?;

        let max_upcoming = state.max_upcoming_appointments();
        if upcoming_count >= max_upcoming {
            tx.rollback().await.map_err(|e| AppError::Database(e))?;
            return Err(AppError::BadRequest(
                format!("You can only have up to {} upcoming appointments at a time. Please cancel or reschedule an existing appointment.", max_upcoming)
            ));
        }

        let doctor_id = body.doctor_id.unwrap_or(new_slot.doctor_id);

        if let Some(req_doctor_id) = body.doctor_id {
            if req_doctor_id != new_slot.doctor_id {
                tx.rollback().await.map_err(|e| AppError::Database(e))?;
                return Err(AppError::BadRequest("Selected slot does not belong to the specified doctor".to_string()));
            }
        }

        check_slot_unavailability_in_tx(&mut tx, new_slot.doctor_id, new_slot.slot_date, new_slot.start_time).await?;

        let existing = sqlx::query_as::<_, (chrono::NaiveTime, chrono::NaiveDate)>(
            "SELECT s.start_time, s.slot_date
             FROM appointments a
             JOIN availability_slots s ON s.id = a.slot_id
             WHERE a.patient_id = $1 AND a.status = 'confirmed' AND s.slot_date = $2 AND a.id != $3"
        )
        .bind(patient.id)
        .bind(new_slot.slot_date)
        .bind(id)
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| AppError::Database(e))?;

        for (existing_time, _) in &existing {
            let diff = (new_slot.start_time - *existing_time).num_minutes().abs();
            let min_gap = state.min_gap_minutes();
            if diff < min_gap {
                tx.rollback().await.map_err(|e| AppError::Database(e))?;
                return Err(AppError::BadRequest(
                    format!("You already have an appointment at {} on {}. There must be at least {} minutes between appointments.", existing_time.format("%H:%M"), new_slot.slot_date, min_gap)
                ));
            }
        }

        let today = chrono::Utc::now().date_naive();
        let min_advance = state.min_advance_days();
        if new_slot.slot_date < today + chrono::Duration::days(min_advance) {
            tx.rollback().await.map_err(|e| AppError::Database(e))?;
            return Err(AppError::BadRequest(
                format!("Appointments must be booked at least {} days in advance. The selected date is too soon.", min_advance)
            ));
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
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::Database(e))?;

        tx.commit().await.map_err(|e| AppError::Database(e))?;
        return Ok(Json(AppointmentResponse {
            id: updated.id,
            patient_id: updated.patient_id,
            doctor_id: updated.doctor_id,
            slot_id: updated.slot_id,
            status: updated.status,
            notes: updated.notes,
            attended: updated.attended,
            cancellation_reason: updated.cancellation_reason,
            created_at: updated.created_at,
        }));
    }

    if let Some(new_doctor_id) = body.doctor_id {
        tracing::info!("Updating doctor for appointment {} to {}", id, new_doctor_id);
        sqlx::query("SELECT id FROM doctors WHERE id = $1")
            .bind(new_doctor_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| AppError::Database(e))?
            .ok_or_else(|| AppError::BadRequest("Doctor not found".to_string()))?;

        let updated = sqlx::query_as::<_, Appointment>(
            "UPDATE appointments SET doctor_id = $2, updated_at = NOW() WHERE id = $1 RETURNING *"
        )
        .bind(id)
        .bind(new_doctor_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::Database(e))?;

        tx.commit().await.map_err(|e| AppError::Database(e))?;
        return Ok(Json(AppointmentResponse {
            id: updated.id,
            patient_id: updated.patient_id,
            doctor_id: updated.doctor_id,
            slot_id: updated.slot_id,
            status: updated.status,
            notes: updated.notes,
            attended: updated.attended,
            cancellation_reason: updated.cancellation_reason,
            created_at: updated.created_at,
        }));
    }

    if let Some(new_status) = &body.status {
        if new_status == "cancelled" {
            let reason = body.cancellation_reason.as_deref().unwrap_or("");
            let updated = sqlx::query_as::<_, Appointment>(
                "WITH cancelled AS (
                    UPDATE appointments SET status = 'cancelled', cancellation_reason = $2, updated_at = NOW() WHERE id = $1 RETURNING *
                ),
                freed AS (
                    UPDATE availability_slots SET is_booked = FALSE WHERE id = (SELECT slot_id FROM cancelled)
                )
                SELECT * FROM cancelled"
            )
            .bind(id)
            .bind(reason)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| AppError::Database(e))?;

            tx.commit().await.map_err(|e| AppError::Database(e))?;
            return Ok(Json(AppointmentResponse {
                id: updated.id,
                patient_id: updated.patient_id,
                doctor_id: updated.doctor_id,
                slot_id: updated.slot_id,
                status: updated.status,
                notes: updated.notes,
                attended: updated.attended,
                cancellation_reason: updated.cancellation_reason,
                created_at: updated.created_at,
            }));
        }
    }

    if let Some(attended) = body.attended {
        let updated = sqlx::query_as::<_, Appointment>(
            "UPDATE appointments SET attended = $2, updated_at = NOW() WHERE id = $1 RETURNING *"
        )
        .bind(id)
        .bind(attended)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::Database(e))?;

        tx.commit().await.map_err(|e| AppError::Database(e))?;
        return Ok(Json(AppointmentResponse {
            id: updated.id,
            patient_id: updated.patient_id,
            doctor_id: updated.doctor_id,
            slot_id: updated.slot_id,
            status: updated.status,
            notes: updated.notes,
            attended: updated.attended,
            cancellation_reason: updated.cancellation_reason,
            created_at: updated.created_at,
        }));
    }

    tx.rollback().await.map_err(|e| AppError::Database(e))?;
    tracing::warn!(
        "No valid update for appointment {} — slot_id={:?}, doctor_id={:?}, status={:?}, attended={:?}",
        id, body.slot_id, body.doctor_id, body.status, body.attended
    );
    Err(AppError::BadRequest("No valid update provided".to_string()))
}

async fn get_patient_from_auth(
    state: &AppState,
    auth: &AuthUser,
) -> Result<crate::models::Patient, AppError> {
    let lookup = normalize_phone_or_raw(&auth.sub);
    let patient = if lookup.contains('@') {
        sqlx::query_as::<_, crate::models::Patient>(
            "SELECT * FROM patients WHERE email = $1"
        )
        .bind(&lookup)
        .fetch_optional(&state.pool)
        .await
    } else {
        sqlx::query_as::<_, crate::models::Patient>(
            "SELECT * FROM patients WHERE phone = $1"
        )
        .bind(&lookup)
        .fetch_optional(&state.pool)
        .await
    }
    .map_err(|e| AppError::Database(e))?
    .ok_or_else(|| AppError::BadRequest("Patient profile not found".to_string()))?;

    Ok(patient)
}

async fn send_confirmation_email(
    state: &AppState,
    patient: &crate::models::Patient,
    appointment: &crate::models::Appointment,
    slot: &crate::models::AvailabilitySlot,
    doctor_id: &Uuid,
) -> Result<(), String> {
    let doctor = sqlx::query_as::<_, (String, String)>(
        "SELECT first_name, last_name FROM doctors WHERE id = $1"
    )
    .bind(doctor_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| format!("Failed to fetch doctor: {}", e))?
    .ok_or_else(|| "Doctor not found".to_string())?;

    let doctor_name = format!("Dr. {} {}", doctor.0, doctor.1);
    let patient_name = format!("{} {}", patient.first_name, patient.last_name);
    let date = slot.slot_date.format("%A, %B %d, %Y").to_string();
    let time = format!("{}:00 - {}:00", slot.start_time.format("%I:%M %p"), slot.end_time.format("%I:%M %p"));

    let clinic_name = state.clinic_name();
    let clinic_address = state.clinic_address();
    state.email_service.send_appointment_confirmation(
        &patient.email,
        &patient_name,
        &doctor_name,
        &date,
        &time,
        &appointment.notes,
        &clinic_name,
        &clinic_address,
    ).await
}

pub fn appointment_routes() -> Router<AppState> {
    Router::new()
        .route("/api/appointments", post(create_appointment))
        .route("/api/appointments/:id", get(get_appointment))
        .route("/api/appointments/:id", patch(update_appointment))
}
