use axum::{Json, extract::{Query, State}, Router, routing::{get, post}};
use serde::Deserialize;
use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::AuthUser;
use crate::models::{LastDoctorInfo, Patient};
use crate::state::AppState;

#[derive(Deserialize)]
pub struct CreatePatientRequest {
    pub first_name: String,
    pub last_name: String,
    pub phone: String,
    pub email: String,
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

    let patient = sqlx::query_as::<_, Patient>(
        "INSERT INTO patients (first_name, last_name, phone, email) VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO UPDATE SET first_name = $1, last_name = $2, phone = $3
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
         WHERE a.patient_id = $1 AND a.status = 'confirmed'
         ORDER BY a.created_at DESC
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

pub fn patient_routes() -> Router<AppState> {
    Router::new()
        .route("/api/patients", post(create_patient))
        .route("/api/patients/lookup", get(lookup_patient))
        .route("/api/patients/:id/last-doctor", get(get_last_doctor))
}
