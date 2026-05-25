use axum::{Json, extract::{Query, State}, Router, routing::{get, post, put}};
use serde::Deserialize;
use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::AuthUser;
use crate::models::{AppointmentHistoryItem, LastDoctorInfo, Patient, UpcomingAppointment};
use crate::state::AppState;

#[derive(Deserialize)]
pub struct CreatePatientRequest {
    pub first_name: String,
    pub last_name: String,
    pub phone: String,
    pub email: String,
}

#[derive(Deserialize)]
pub struct UpdatePatientRequest {
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
}

#[derive(Deserialize)]
pub struct LookupQuery {
    pub identifier: String,
}

pub async fn create_patient(
    State(state): State<AppState>,
    _auth: AuthUser,
    Json(body): Json<CreatePatientRequest>,
) -> Result<Json<Patient>, AppError> {
    let first_name = body.first_name.trim().to_string();
    let last_name = body.last_name.trim().to_string();
    let phone = body.phone.trim().to_string();
    let email = body.email.trim().to_lowercase();

    if first_name.is_empty() || last_name.is_empty() {
        return Err(AppError::Validation("First name and last name are required".to_string()));
    }
    if phone.is_empty() || email.is_empty() {
        return Err(AppError::Validation("Phone and email are required".to_string()));
    }

    let existing = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM patients WHERE email = $1 OR phone = $2"
    )
    .bind(&email)
    .bind(&phone)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    if existing > 0 {
        return Err(AppError::BadRequest(
            "A patient with this email or phone number already exists".to_string()
        ));
    }

    let patient = sqlx::query_as::<_, Patient>(
        "INSERT INTO patients (first_name, last_name, phone, email) VALUES ($1, $2, $3, $4)
         RETURNING *"
    )
    .bind(&first_name)
    .bind(&last_name)
    .bind(&phone)
    .bind(&email)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    Ok(Json(patient))
}

pub async fn lookup_patient(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(query): Query<LookupQuery>,
) -> Result<Json<Patient>, AppError> {
    let identifier = query.identifier.trim().to_lowercase();

    let patient = if identifier.contains('@') {
        sqlx::query_as::<_, Patient>(
            "SELECT * FROM patients WHERE email = $1"
        )
        .bind(&identifier)
        .fetch_optional(&state.pool)
    } else {
        sqlx::query_as::<_, Patient>(
            "SELECT * FROM patients WHERE phone = $1"
        )
        .bind(&identifier)
        .fetch_optional(&state.pool)
    }
    .await
    .map_err(|e| AppError::Database(e))?
    .ok_or_else(|| AppError::NotFound("Patient not found".to_string()))?;

    Ok(Json(patient))
}

pub async fn get_last_doctor(
    State(state): State<AppState>,
    _auth: AuthUser,
    axum::extract::Path(patient_id): axum::extract::Path<Uuid>,
) -> Result<Json<Option<LastDoctorInfo>>, AppError> {
    let result = sqlx::query_as::<_, (Uuid, String, String, chrono::NaiveDate, chrono::NaiveTime)>(
        "SELECT d.id, d.first_name || ' ' || d.last_name, d.specialization, s.slot_date, s.start_time
         FROM appointments a
         JOIN doctors d ON d.id = a.doctor_id
         JOIN availability_slots s ON s.id = a.slot_id
         WHERE a.patient_id = $1 AND a.status = 'confirmed' AND s.slot_date < CURRENT_DATE
         ORDER BY s.slot_date DESC, s.start_time DESC
         LIMIT 1"
    )
    .bind(patient_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    Ok(Json(result.map(|(doctor_id, doctor_name, specialization, slot_date, start_time)| LastDoctorInfo {
        doctor_id,
        doctor_name,
        specialization,
        last_appointment_date: slot_date,
        last_appointment_time: start_time,
    })))
}

pub async fn get_upcoming_appointments(
    State(state): State<AppState>,
    _auth: AuthUser,
    axum::extract::Path(patient_id): axum::extract::Path<Uuid>,
) -> Result<Json<Vec<UpcomingAppointment>>, AppError> {
    let appointments = sqlx::query_as::<_, UpcomingAppointment>(
        "SELECT a.id, d.id as doctor_id, d.first_name || ' ' || d.last_name as doctor_name,
                d.specialization, s.slot_date, s.start_time, a.status
         FROM appointments a
         JOIN doctors d ON d.id = a.doctor_id
         JOIN availability_slots s ON s.id = a.slot_id
         WHERE a.patient_id = $1 AND a.status = 'confirmed' AND s.slot_date >= CURRENT_DATE
         ORDER BY s.slot_date ASC, s.start_time ASC"
    )
    .bind(patient_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    Ok(Json(appointments))
}

pub async fn get_appointment_history(
    State(state): State<AppState>,
    _auth: AuthUser,
    axum::extract::Path(patient_id): axum::extract::Path<Uuid>,
) -> Result<Json<Vec<AppointmentHistoryItem>>, AppError> {
    let appointments = sqlx::query_as::<_, AppointmentHistoryItem>(
        "SELECT a.id, d.id as doctor_id, d.first_name || ' ' || d.last_name as doctor_name,
                d.specialization, s.slot_date, s.start_time, s.end_time, a.status, a.notes
         FROM appointments a
         JOIN doctors d ON d.id = a.doctor_id
         JOIN availability_slots s ON s.id = a.slot_id
         WHERE a.patient_id = $1 AND s.slot_date < CURRENT_DATE
         ORDER BY s.slot_date DESC, s.start_time DESC"
    )
    .bind(patient_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    Ok(Json(appointments))
}

pub async fn update_patient(
    State(state): State<AppState>,
    _auth: AuthUser,
    axum::extract::Path(patient_id): axum::extract::Path<Uuid>,
    Json(body): Json<UpdatePatientRequest>,
) -> Result<Json<Patient>, AppError> {
    let current = sqlx::query_as::<_, Patient>(
        "SELECT * FROM patients WHERE id = $1"
    )
    .bind(patient_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?
    .ok_or_else(|| AppError::NotFound("Patient not found".to_string()))?;

    let first_name = body.first_name.map(|v| v.trim().to_string()).filter(|v| !v.is_empty()).unwrap_or_else(|| current.first_name.clone());
    let last_name = body.last_name.map(|v| v.trim().to_string()).filter(|v| !v.is_empty()).unwrap_or_else(|| current.last_name.clone());
    let phone = body.phone.map(|v| v.trim().to_string()).filter(|v| !v.is_empty()).unwrap_or_else(|| current.phone.clone());
    let email = body.email.map(|v| v.trim().to_lowercase()).filter(|v| !v.is_empty()).unwrap_or_else(|| current.email.clone());

    if email != current.email || phone != current.phone {
        let existing = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM patients WHERE (email = $1 OR phone = $2) AND id != $3"
        )
        .bind(&email)
        .bind(&phone)
        .bind(patient_id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| AppError::Database(e))?;

        if existing > 0 {
            return Err(AppError::BadRequest(
                "A patient with this email or phone number already exists".to_string()
            ));
        }
    }

    let patient = sqlx::query_as::<_, Patient>(
        "UPDATE patients SET first_name = $1, last_name = $2, phone = $3, email = $4, updated_at = NOW()
         WHERE id = $5 RETURNING *"
    )
    .bind(&first_name)
    .bind(&last_name)
    .bind(&phone)
    .bind(&email)
    .bind(patient_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    Ok(Json(patient))
}

pub fn patient_routes() -> Router<AppState> {
    Router::new()
        .route("/api/patients", post(create_patient))
        .route("/api/patients/lookup", get(lookup_patient))
        .route("/api/patients/:id/last-doctor", get(get_last_doctor))
        .route("/api/patients/:id/upcoming-appointments", get(get_upcoming_appointments))
        .route("/api/patients/:id/history", get(get_appointment_history))
        .route("/api/patients/:id", put(update_patient))
}
