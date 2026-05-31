use axum::{Json, extract::{Path, State, Query}, Router, routing::{get, patch}};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::NaiveDate;

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
pub struct RescheduleRequest {
    pub slot_id: Uuid,
    pub doctor_id: Option<Uuid>,
}

#[derive(Deserialize)]
pub struct ChangeDoctorRequest {
    pub doctor_id: Uuid,
}

#[derive(Deserialize)]
pub struct CancelAppointmentRequest {
    pub cancellation_reason: Option<String>,
}

#[derive(Deserialize)]
pub struct MarkAttendanceRequest {
    pub attended: bool,
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

#[derive(Deserialize)]
pub struct ListAppointmentsQuery {
    pub doctor_id: Option<Uuid>,
    pub date: Option<NaiveDate>,
    pub from: Option<NaiveDate>,
    pub to: Option<NaiveDate>,
    pub status: Option<String>,
}

pub async fn list_appointments(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<ListAppointmentsQuery>,
) -> Result<Json<Vec<crate::models::AppointmentHistoryItem>>, AppError> {
    let (doctor_id, patient_id) = match auth.role.as_str() {
        "admin" | "scheduler" => (query.doctor_id, None),
        "doctor" => {
            let doc = sqlx::query_as::<_, (Uuid,)>(
                "SELECT id FROM doctors WHERE email = $1"
            )
            .bind(&auth.sub)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| AppError::Database(e))?
            .ok_or_else(|| AppError::Unauthorized("Doctor profile not found".to_string()))?;
            (Some(doc.0), None)
        }
        _ => {
            let patient = get_patient_from_auth(&state, &auth).await?;
            (None, Some(patient.id))
        }
    };

    let mut sql = String::from(
        "SELECT a.id, a.doctor_id, d.first_name || ' ' || d.last_name AS doctor_name,
                d.specialization, s.slot_date, s.start_time, s.end_time,
                a.status, a.notes, a.attended, a.cancellation_reason
         FROM appointments a
         JOIN doctors d ON d.id = a.doctor_id
         JOIN availability_slots s ON s.id = a.slot_id
         WHERE 1=1"
    );
    let mut param_idx = 1u32;

    if let Some(_) = doctor_id {
        sql.push_str(&format!(" AND a.doctor_id = ${}", param_idx));
        param_idx += 1;
    }
    if let Some(_) = patient_id {
        sql.push_str(&format!(" AND a.patient_id = ${}", param_idx));
        param_idx += 1;
    }
    if let Some(_) = query.date {
        sql.push_str(&format!(" AND s.slot_date = ${}", param_idx));
        param_idx += 1;
    } else {
        if let Some(_) = query.from {
            sql.push_str(&format!(" AND s.slot_date >= ${}", param_idx));
            param_idx += 1;
        }
        if let Some(_) = query.to {
            sql.push_str(&format!(" AND s.slot_date <= ${}", param_idx));
            param_idx += 1;
        }
    }
    if let Some(_) = &query.status {
        sql.push_str(&format!(" AND a.status = ${}", param_idx));
    }

    sql.push_str(" ORDER BY s.slot_date DESC, s.start_time DESC LIMIT 100");

    let mut q = sqlx::query_as::<_, crate::models::AppointmentHistoryItem>(&sql);

    if let Some(did) = doctor_id { q = q.bind(did); }
    if let Some(pid) = patient_id { q = q.bind(pid); }
    if let Some(d) = query.date { q = q.bind(d); }
    else {
        if let Some(f) = query.from { q = q.bind(f); }
        if let Some(t) = query.to { q = q.bind(t); }
    }
    if let Some(ref st) = query.status { q = q.bind(st); }

    let appointments = q.fetch_all(&state.pool).await.map_err(|e| AppError::Database(e))?;
    Ok(Json(appointments))
}

pub async fn export_appointments(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<ListAppointmentsQuery>,
) -> Result<(axum::http::StatusCode, [(&'static str, String); 2], String), AppError> {
    if auth.role != "admin" && auth.role != "scheduler" {
        return Err(AppError::Unauthorized("Only admin and scheduler can export appointments".to_string()));
    }

    let mut sql = String::from(
        "SELECT a.id, a.doctor_id, d.first_name || ' ' || d.last_name AS doctor_name,
                d.specialization, s.slot_date, s.start_time, s.end_time,
                a.status, a.notes, a.attended, a.cancellation_reason
         FROM appointments a
         JOIN doctors d ON d.id = a.doctor_id
         JOIN availability_slots s ON s.id = a.slot_id
         WHERE 1=1"
    );
    let mut param_idx = 1u32;

    if let Some(_) = query.doctor_id {
        sql.push_str(&format!(" AND a.doctor_id = ${}", param_idx));
        param_idx += 1;
    }
    if let Some(_) = query.date {
        sql.push_str(&format!(" AND s.slot_date = ${}", param_idx));
        param_idx += 1;
    } else {
        if let Some(_) = query.from {
            sql.push_str(&format!(" AND s.slot_date >= ${}", param_idx));
            param_idx += 1;
        }
        if let Some(_) = query.to {
            sql.push_str(&format!(" AND s.slot_date <= ${}", param_idx));
            param_idx += 1;
        }
    }
    if let Some(_) = &query.status {
        sql.push_str(&format!(" AND a.status = ${}", param_idx));
    }

    sql.push_str(" ORDER BY s.slot_date ASC, s.start_time ASC");

    let mut query_builder = sqlx::query_as::<_, crate::models::AppointmentHistoryItem>(&sql);
    if let Some(did) = query.doctor_id { query_builder = query_builder.bind(did); }
    if let Some(d) = query.date { query_builder = query_builder.bind(d); }
    else {
        if let Some(f) = query.from { query_builder = query_builder.bind(f); }
        if let Some(t) = query.to { query_builder = query_builder.bind(t); }
    }
    if let Some(ref st) = query.status { query_builder = query_builder.bind(st); }

    let appointments = query_builder.fetch_all(&state.pool).await.map_err(|e| AppError::Database(e))?;

    let mut csv = String::from("ID,Doctor,Specialization,Date,Start Time,End Time,Status,Notes,Attended,Cancellation Reason\n");
    for a in &appointments {
        csv.push_str(&format!(
            "{},{},{},{},{},{},{},{},{},{}\n",
            a.id,
            a.doctor_name.replace(',', " "),
            a.specialization.replace(',', " "),
            a.slot_date,
            a.start_time.format("%H:%M"),
            a.end_time.format("%H:%M"),
            a.status,
            a.notes.replace(',', " "),
            a.attended.map(|v| v.to_string()).unwrap_or_default(),
            a.cancellation_reason.replace(',', " "),
        ));
    }

    Ok((
        axum::http::StatusCode::OK,
        [
            ("Content-Type", "text/csv; charset=utf-8".to_string()),
            ("Content-Disposition", "attachment; filename=\"appointments.csv\"".to_string()),
        ],
        csv,
    ))
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

    // Notify clinic staff about new booking
    if let Some(ref notify_email) = state.notification_email {
        let clinic_name = state.clinic_name();
        let doctor = sqlx::query_as::<_, (String, String)>(
            "SELECT first_name, last_name FROM doctors WHERE id = $1"
        )
        .bind(doctor_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| AppError::Database(e))?;

        let doctor_name = doctor
            .map(|(f, l)| format!("Dr. {} {}", f, l))
            .unwrap_or_else(|| "Unknown".to_string());
        let date = slot.slot_date.format("%A, %B %d, %Y").to_string();
        let time = format!("{}:00 - {}:00", slot.start_time.format("%I:%M %p"), slot.end_time.format("%I:%M %p"));
        let patient_name = format!("{} {}", patient.first_name, patient.last_name);

        let subject = format!("New Booking - {}", clinic_name);
        let body = format!(
            "A new appointment has been booked:\n\n\
             Patient: {}\n\
             Doctor: {}\n\
             Date: {}\n\
             Time: {}\n\
             Notes: {}\n\n\
             ---\n\
             {}\n{}",
            patient_name, doctor_name, date, time, appointment.notes,
            clinic_name, state.clinic_address()
        );

        state.email_service.send_notification(notify_email, &subject, &body).await;
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

async fn get_appointment_for_update(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    state: &AppState,
    auth: &AuthUser,
    id: Uuid,
) -> Result<(crate::models::Patient, Appointment), AppError> {
    if auth.role == "admin" || auth.role == "scheduler" {
        let appt = sqlx::query_as::<_, Appointment>(
            "SELECT * FROM appointments WHERE id = $1 AND status = 'confirmed'"
        )
        .bind(id)
        .fetch_optional(&mut **tx)
        .await
        .map_err(|e| AppError::Database(e))?
        .ok_or_else(|| AppError::NotFound("Appointment not found or already cancelled".to_string()))?;
        let patient = sqlx::query_as::<_, crate::models::Patient>(
            "SELECT * FROM patients WHERE id = $1"
        )
        .bind(appt.patient_id)
        .fetch_optional(&mut **tx)
        .await
        .map_err(|e| AppError::Database(e))?
        .ok_or_else(|| AppError::BadRequest("Patient profile not found".to_string()))?;
        Ok((patient, appt))
    } else {
        let patient = get_patient_from_auth(state, auth).await?;
        let appt = sqlx::query_as::<_, Appointment>(
            "SELECT * FROM appointments WHERE id = $1 AND patient_id = $2 AND status = 'confirmed'"
        )
        .bind(id)
        .bind(patient.id)
        .fetch_optional(&mut **tx)
        .await
        .map_err(|e| AppError::Database(e))?
        .ok_or_else(|| AppError::NotFound("Appointment not found or already cancelled".to_string()))?;
        Ok((patient, appt))
    }
}

async fn free_and_update_slot(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    appointment_id: Uuid,
    new_slot_id: Uuid,
    new_doctor_id: Uuid,
) -> Result<Appointment, AppError> {
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
    .bind(appointment_id)
    .bind(new_slot_id)
    .bind(new_doctor_id)
    .fetch_one(&mut **tx)
    .await
    .map_err(|e| AppError::Database(e))?;
    Ok(updated)
}

pub async fn cancel_appointment(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<CancelAppointmentRequest>,
) -> Result<Json<AppointmentResponse>, AppError> {
    state.check_mutation_rate_limit(&format!("cancel_appointment:{}", auth.sub))?;
    let reason = body.cancellation_reason.unwrap_or_default();
    validate_length(&reason, "Cancellation reason", 500)?;

    let mut tx = state.pool.begin().await.map_err(|e| AppError::Database(e))?;
    let (_patient, _appt) = get_appointment_for_update(&mut tx, &state, &auth, id).await?;

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
    .bind(&reason)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Database(e))?;

    tx.commit().await.map_err(|e| AppError::Database(e))?;

    Ok(Json(AppointmentResponse {
        id: updated.id,
        patient_id: updated.patient_id,
        doctor_id: updated.doctor_id,
        slot_id: updated.slot_id,
        status: updated.status,
        notes: updated.notes,
        attended: updated.attended,
        cancellation_reason: updated.cancellation_reason,
        created_at: updated.created_at,
    }))
}

pub async fn reschedule_appointment(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<RescheduleRequest>,
) -> Result<Json<AppointmentResponse>, AppError> {
    state.check_mutation_rate_limit(&format!("reschedule_appointment:{}", auth.sub))?;

    let mut tx = state.pool.begin().await.map_err(|e| AppError::Database(e))?;
    let (patient, _appt) = get_appointment_for_update(&mut tx, &state, &auth, id).await?;

    let new_slot = sqlx::query_as::<_, crate::models::AvailabilitySlot>(
        "SELECT * FROM availability_slots WHERE id = $1 AND is_booked = FALSE FOR UPDATE"
    )
    .bind(body.slot_id)
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

    let updated = free_and_update_slot(&mut tx, id, body.slot_id, doctor_id).await?;
    tx.commit().await.map_err(|e| AppError::Database(e))?;

    Ok(Json(AppointmentResponse {
        id: updated.id,
        patient_id: updated.patient_id,
        doctor_id: updated.doctor_id,
        slot_id: updated.slot_id,
        status: updated.status,
        notes: updated.notes,
        attended: updated.attended,
        cancellation_reason: updated.cancellation_reason,
        created_at: updated.created_at,
    }))
}

pub async fn change_doctor(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<ChangeDoctorRequest>,
) -> Result<Json<AppointmentResponse>, AppError> {
    state.check_mutation_rate_limit(&format!("change_doctor:{}", auth.sub))?;

    let mut tx = state.pool.begin().await.map_err(|e| AppError::Database(e))?;
    let (_patient, _appt) = get_appointment_for_update(&mut tx, &state, &auth, id).await?;

    sqlx::query("SELECT id FROM doctors WHERE id = $1")
        .bind(body.doctor_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| AppError::Database(e))?
        .ok_or_else(|| AppError::BadRequest("Doctor not found".to_string()))?;

    let updated = sqlx::query_as::<_, Appointment>(
        "UPDATE appointments SET doctor_id = $2, updated_at = NOW() WHERE id = $1 RETURNING *"
    )
    .bind(id)
    .bind(body.doctor_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Database(e))?;

    tx.commit().await.map_err(|e| AppError::Database(e))?;

    Ok(Json(AppointmentResponse {
        id: updated.id,
        patient_id: updated.patient_id,
        doctor_id: updated.doctor_id,
        slot_id: updated.slot_id,
        status: updated.status,
        notes: updated.notes,
        attended: updated.attended,
        cancellation_reason: updated.cancellation_reason,
        created_at: updated.created_at,
    }))
}

pub async fn mark_attendance(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<MarkAttendanceRequest>,
) -> Result<Json<AppointmentResponse>, AppError> {
    state.check_mutation_rate_limit(&format!("mark_attendance:{}", auth.sub))?;

    let updated = if auth.role == "admin" || auth.role == "scheduler" {
        sqlx::query_as::<_, Appointment>(
            "UPDATE appointments SET attended = $2, updated_at = NOW() WHERE id = $1 RETURNING *"
        )
        .bind(id)
        .bind(body.attended)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| {
            if let sqlx::Error::RowNotFound = e {
                AppError::NotFound("Appointment not found".to_string())
            } else {
                AppError::Database(e)
            }
        })?
    } else {
        let patient = get_patient_from_auth(&state, &auth).await?;
        sqlx::query_as::<_, Appointment>(
            "UPDATE appointments SET attended = $2, updated_at = NOW() WHERE id = $1 AND patient_id = $3 RETURNING *"
        )
        .bind(id)
        .bind(body.attended)
        .bind(patient.id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| {
            if let sqlx::Error::RowNotFound = e {
                AppError::NotFound("Appointment not found".to_string())
            } else {
                AppError::Database(e)
            }
        })?
    };

    Ok(Json(AppointmentResponse {
        id: updated.id,
        patient_id: updated.patient_id,
        doctor_id: updated.doctor_id,
        slot_id: updated.slot_id,
        status: updated.status,
        notes: updated.notes,
        attended: updated.attended,
        cancellation_reason: updated.cancellation_reason,
        created_at: updated.created_at,
    }))
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
        .route("/api/appointments", get(list_appointments).post(create_appointment))
        .route("/api/appointments/export", get(export_appointments))
        .route("/api/appointments/:id", get(get_appointment))
        .route("/api/appointments/:id/cancel", patch(cancel_appointment))
        .route("/api/appointments/:id/reschedule", patch(reschedule_appointment))
        .route("/api/appointments/:id/change-doctor", patch(change_doctor))
        .route("/api/appointments/:id/attendance", patch(mark_attendance))
}
