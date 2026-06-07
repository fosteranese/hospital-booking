use axum::{Json, extract::{Path, Query, State}, Router, routing::{get, post, put}};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{AppError, validate_length};
use crate::middleware::auth::{AuthUser, require_role};
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
pub struct CheckPatientQuery {
    pub email: Option<String>,
    pub phone: Option<String>,
}

#[derive(Serialize)]
pub struct CheckPatientResponse {
    pub email_taken: bool,
    pub phone_taken: bool,
}

pub async fn create_patient(
    State(state): State<AppState>,
    _auth: AuthUser,
    Json(body): Json<CreatePatientRequest>,
) -> Result<Json<Patient>, AppError> {
    state.check_mutation_rate_limit(&format!("create_patient:{}", _auth.sub))?;

    let first_name = body.first_name.trim().to_string();
    let last_name = body.last_name.trim().to_string();
    let phone = normalize_phone(body.phone.trim());
    let email = body.email.trim().to_lowercase();

    if first_name.is_empty() || last_name.is_empty() {
        return Err(AppError::Validation("First name and last name are required".to_string()));
    }

    validate_length(&first_name, "First name", 100)?;
    validate_length(&last_name, "Last name", 100)?;
    validate_length(&email, "Email", 255)?;
    validate_length(&phone, "Phone", 20)?;

    if !email.is_empty() {
        validate_email(&email)?;
    }
    if !phone.is_empty() {
        validate_phone(&phone)?;
    }

    if !email.is_empty() || !phone.is_empty() {
        let existing = if !email.is_empty() && !phone.is_empty() {
            sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM patients WHERE email = $1 OR phone = $2"
            )
            .bind(&email)
            .bind(&phone)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| AppError::Database(e))?
        } else if !email.is_empty() {
            sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM patients WHERE email = $1"
            )
            .bind(&email)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| AppError::Database(e))?
        } else {
            sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM patients WHERE phone = $1"
            )
            .bind(&phone)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| AppError::Database(e))?
        };

        if existing > 0 {
            return Err(AppError::Conflict(
                "A patient with this email or phone number already exists".to_string()
            ));
        }
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
) -> Result<Json<Patient>, AppError> {
    let identifier = normalize_phone_or_raw(&_auth.sub);

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

async fn verify_patient_access(pool: &sqlx::PgPool, auth: &AuthUser, patient_id: Uuid) -> Result<(), AppError> {
    // Admin and scheduler can access any patient data
    if auth.role == "admin" || auth.role == "scheduler" {
        // Verify patient exists
        let exists = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM patients WHERE id = $1"
        )
        .bind(patient_id)
        .fetch_one(pool)
        .await
        .map_err(|e| AppError::Database(e))?;
        return if exists > 0 {
            Ok(())
        } else {
            Err(AppError::NotFound("Patient not found".to_string()))
        };
    }

    let lookup = normalize_phone_or_raw(&auth.sub);
    let patient = if lookup.contains('@') {
        sqlx::query_as::<_, Patient>("SELECT * FROM patients WHERE email = $1")
            .bind(&lookup)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::Database(e))?
    } else {
        sqlx::query_as::<_, Patient>("SELECT * FROM patients WHERE phone = $1")
            .bind(&lookup)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::Database(e))?
    };

    match patient {
        Some(p) if p.id == patient_id => Ok(()),
        Some(_) => Err(AppError::Unauthorized("You can only access your own patient data".to_string())),
        None => Err(AppError::Unauthorized("No patient profile linked to this account".to_string())),
    }
}

fn validate_email(email: &str) -> Result<(), AppError> {
    if !email.is_empty() {
        let parts: Vec<&str> = email.split('@').collect();
        if parts.len() != 2 || parts[0].is_empty() || parts[1].is_empty() || !parts[1].contains('.') {
            return Err(AppError::Validation("Invalid email format".to_string()));
        }
    }
    Ok(())
}

fn normalize_phone(raw: &str) -> String {
    if raw.is_empty() {
        return String::new();
    }
    let digits: String = raw.chars().filter(|c| c.is_ascii_digit()).collect();
    match digits.len() {
        9 => format!("+233{}", digits),
        10 if digits.starts_with('0') => format!("+233{}", &digits[1..]),
        12 if digits.starts_with("233") => format!("+{}", digits),
        13 if digits.starts_with("2330") => format!("+233{}", &digits[4..]),
        _ => {
            if raw.starts_with('+') {
                raw.to_string()
            } else {
                format!("+{}", digits)
            }
        }
    }
}

pub(crate) fn normalize_phone_or_raw(raw: &str) -> String {
    if raw.contains('@') {
        raw.to_lowercase()
    } else {
        normalize_phone(raw)
    }
}

fn validate_phone(phone: &str) -> Result<(), AppError> {
    if !phone.is_empty() {
        let digits: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();
        if digits.len() < 10 {
            return Err(AppError::Validation("Phone number must contain at least 10 digits".to_string()));
        }
    }
    Ok(())
}

pub async fn get_last_doctor(
    State(state): State<AppState>,
    auth: AuthUser,
    axum::extract::Path(patient_id): axum::extract::Path<Uuid>,
) -> Result<Json<Option<LastDoctorInfo>>, AppError> {
    verify_patient_access(&state.pool, &auth, patient_id).await?;
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
    auth: AuthUser,
    axum::extract::Path(patient_id): axum::extract::Path<Uuid>,
) -> Result<Json<Vec<UpcomingAppointment>>, AppError> {
    verify_patient_access(&state.pool, &auth, patient_id).await?;
    let appointments = sqlx::query_as::<_, UpcomingAppointment>(
        "SELECT a.id, d.id as doctor_id, d.first_name || ' ' || d.last_name as doctor_name,
                d.specialization, s.slot_date, s.start_time, s.end_time, a.status, a.notes
         FROM appointments a
         JOIN doctors d ON d.id = a.doctor_id
         JOIN availability_slots s ON s.id = a.slot_id
          WHERE a.patient_id = $1 AND a.status = 'confirmed' AND s.slot_date >= CURRENT_DATE
         ORDER BY s.slot_date ASC, s.start_time ASC
         LIMIT 100"
    )
    .bind(patient_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    Ok(Json(appointments))
}

pub async fn get_appointment_history(
    State(state): State<AppState>,
    auth: AuthUser,
    axum::extract::Path(patient_id): axum::extract::Path<Uuid>,
) -> Result<Json<Vec<AppointmentHistoryItem>>, AppError> {
    verify_patient_access(&state.pool, &auth, patient_id).await?;
    let appointments = sqlx::query_as::<_, AppointmentHistoryItem>(
        "SELECT a.id, a.patient_id, p.first_name || ' ' || p.last_name AS patient_name,
                p.email AS patient_email, p.phone AS patient_phone,
                d.id as doctor_id, d.first_name || ' ' || d.last_name as doctor_name,
                d.specialization, s.slot_date, s.start_time, s.end_time, a.status, a.notes, CASE WHEN a.attended IS NULL AND s.slot_date < CURRENT_DATE AND a.status != 'cancelled' THEN false ELSE a.attended END AS attended,
                a.minutes_late, a.cancellation_reason
         FROM appointments a
         JOIN patients p ON p.id = a.patient_id
         JOIN doctors d ON d.id = a.doctor_id
         JOIN availability_slots s ON s.id = a.slot_id
          WHERE a.patient_id = $1 AND (s.slot_date < CURRENT_DATE OR a.status = 'cancelled')
         ORDER BY s.slot_date DESC, s.start_time DESC
         LIMIT 100"
    )
    .bind(patient_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    Ok(Json(appointments))
}

pub async fn update_patient(
    State(state): State<AppState>,
    auth: AuthUser,
    axum::extract::Path(patient_id): axum::extract::Path<Uuid>,
    Json(body): Json<UpdatePatientRequest>,
) -> Result<Json<Patient>, AppError> {
    state.check_mutation_rate_limit(&format!("update_patient:{}", auth.sub))?;
    verify_patient_access(&state.pool, &auth, patient_id).await?;
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
    let phone = body.phone.map(|v| normalize_phone(v.trim())).filter(|v| !v.is_empty()).unwrap_or_else(|| current.phone.clone());
    let email = body.email.map(|v| v.trim().to_lowercase()).filter(|v| !v.is_empty()).unwrap_or_else(|| current.email.clone());

    validate_length(&first_name, "First name", 100)?;
    validate_length(&last_name, "Last name", 100)?;
    validate_length(&email, "Email", 255)?;
    validate_length(&phone, "Phone", 20)?;

    if !email.is_empty() {
        validate_email(&email)?;
    }
    if !phone.is_empty() {
        validate_phone(&phone)?;
    }

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
            return Err(AppError::Conflict(
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

// --- Patient search (admin/scheduler) ---

#[derive(Deserialize)]
pub struct PatientSearchQuery {
    pub q: String,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct PatientSearchResult {
    pub id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub phone: String,
    pub email: String,
}

pub async fn search_patients(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<PatientSearchQuery>,
) -> Result<Json<Vec<PatientSearchResult>>, AppError> {
    require_role(&auth, &["admin", "scheduler"])?;
    let q = query.q.trim().to_lowercase();
    if q.is_empty() {
        return Ok(Json(vec![]));
    }

    let like = format!("%{}%", q);
    let patients = sqlx::query_as::<_, PatientSearchResult>(
        "SELECT id, first_name, last_name, phone, email FROM patients
         WHERE LOWER(first_name) LIKE $1
            OR LOWER(last_name) LIKE $1
            OR LOWER(email) LIKE $1
            OR phone LIKE $1
         ORDER BY first_name LIMIT 50"
    )
    .bind(&like)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    Ok(Json(patients))
}

pub async fn check_patient_exists(
    State(state): State<AppState>,
    Query(query): Query<CheckPatientQuery>,
) -> Result<Json<bool>, AppError> {
    if query.email.is_none() && query.phone.is_none() {
        return Err(AppError::Validation("Either email or phone is required".to_string()));
    }
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM patients WHERE ($1::text IS NULL OR email = $1) AND ($2::text IS NULL OR phone = $2))"
    )
    .bind(&query.email)
    .bind(&query.phone)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;
    Ok(Json(exists))
}

#[derive(Serialize, sqlx::FromRow)]
pub struct PatientDoctorInfo {
    pub id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub specialization: String,
}

pub async fn get_patient_doctors(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<PatientDoctorInfo>>, AppError> {
    if auth.role == "patient" {
        return Err(AppError::Unauthorized("Patients cannot access this endpoint".to_string()));
    }

    let doctors = sqlx::query_as::<_, PatientDoctorInfo>(
        "SELECT DISTINCT d.id, d.first_name, d.last_name, d.specialization
         FROM doctors d
         JOIN appointments a ON a.doctor_id = d.id
         WHERE a.patient_id = $1
         ORDER BY d.first_name"
    )
    .bind(patient_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    Ok(Json(doctors))
}

pub fn patient_routes() -> Router<AppState> {
    Router::new()
        .route("/api/patients/check", get(check_patient_exists))
        .route("/api/patients", post(create_patient))
        .route("/api/patients/lookup", get(lookup_patient))
        .route("/api/patients/search", get(search_patients))
        .route("/api/patients/:id/last-doctor", get(get_last_doctor))
        .route("/api/patients/:id/upcoming-appointments", get(get_upcoming_appointments))
        .route("/api/patients/:id/history", get(get_appointment_history))
        .route("/api/patients/:id", put(update_patient))
        .route("/api/patients/:id/doctors", get(get_patient_doctors))
}
