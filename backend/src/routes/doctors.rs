use axum::{
    Json, extract::{Path, Query, State}, Router, routing::get,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{AppError, validate_length};
use crate::middleware::auth::{AuthUser, require_role};
use crate::models::{AvailabilitySlot, DoctorUnavailability, DoctorWithName};
use crate::state::AppState;

#[derive(Deserialize)]
pub struct AvailabilityQuery {
    pub date: String,
    pub patient_id: Option<Uuid>,
}

#[derive(Serialize)]
pub struct SlotResponse {
    pub id: Uuid,
    pub doctor_id: Uuid,
    pub slot_date: String,
    pub start_time: String,
    pub end_time: String,
    pub is_booked: bool,
    pub is_blocked: bool,
}

#[derive(Serialize)]
pub struct SlotWithDoctor {
    pub id: Uuid,
    pub doctor_id: Uuid,
    pub slot_date: String,
    pub start_time: String,
    pub end_time: String,
    pub doctor_name: String,
    pub specialization: String,
    pub is_booked: bool,
    pub is_blocked: bool,
}

async fn load_blocked_times(
    state: &AppState,
    patient_id: Option<Uuid>,
    date: chrono::NaiveDate,
) -> Result<Vec<chrono::NaiveTime>, AppError> {
    let Some(pid) = patient_id else { return Ok(vec![]) };
    let rows = sqlx::query_as::<_, (chrono::NaiveTime,)>(
        "SELECT s.start_time
         FROM appointments a
         JOIN availability_slots s ON s.id = a.slot_id
         WHERE a.patient_id = $1 AND a.status = 'confirmed' AND s.slot_date = $2"
    )
    .bind(pid)
    .bind(date)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;
    Ok(rows.into_iter().map(|(t,)| t).collect())
}

fn is_blocked(slot_time: chrono::NaiveTime, existing_times: &[chrono::NaiveTime], min_gap_minutes: i64) -> bool {
    existing_times.iter().any(|et| (slot_time - *et).num_minutes().abs() < min_gap_minutes)
}

async fn load_unavailability(
    state: &AppState,
    doctor_id: Uuid,
    date: chrono::NaiveDate,
) -> Result<Vec<DoctorUnavailability>, AppError> {
    let rows = sqlx::query_as::<_, DoctorUnavailability>(
        "SELECT * FROM doctor_unavailability WHERE doctor_id = $1 AND slot_date = $2"
    )
    .bind(doctor_id)
    .bind(date)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;
    Ok(rows)
}

fn is_unavailable(slot_time: chrono::NaiveTime, unavailability: &[DoctorUnavailability]) -> bool {
    unavailability.iter().any(|u| {
        // Full-day off
        if u.start_time.is_none() && u.end_time.is_none() {
            return true;
        }
        // Time-range off: slot start falls within [start_time, end_time)
        if let (Some(st), Some(et)) = (u.start_time, u.end_time) {
            if slot_time >= st && slot_time < et {
                return true;
            }
        }
        false
    })
}

pub async fn list_doctors(
    State(state): State<AppState>,
) -> Result<Json<Vec<DoctorWithName>>, AppError> {
    let doctors = sqlx::query_as::<_, DoctorWithName>(
        "SELECT id, first_name, last_name, specialization FROM doctors ORDER BY first_name"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    Ok(Json(doctors))
}

pub async fn get_availability(
    State(state): State<AppState>,
    Path(doctor_id): Path<Uuid>,
    Query(query): Query<AvailabilityQuery>,
) -> Result<Json<Vec<SlotResponse>>, AppError> {
    let date = chrono::NaiveDate::parse_from_str(&query.date, "%Y-%m-%d")
        .map_err(|_| AppError::Validation("Invalid date format, use YYYY-MM-DD".to_string()))?;

    let slots = sqlx::query_as::<_, AvailabilitySlot>(
        "SELECT * FROM availability_slots WHERE doctor_id = $1 AND slot_date = $2 ORDER BY start_time"
    )
    .bind(doctor_id)
    .bind(date)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    let blocked_times = load_blocked_times(&state, query.patient_id, date).await?;
    let unavailability = load_unavailability(&state, doctor_id, date).await?;

    let response: Vec<SlotResponse> = slots
        .into_iter()
        .map(|s| {
            let blocked = s.is_booked
                || is_blocked(s.start_time, &blocked_times, state.min_gap_minutes())
                || is_unavailable(s.start_time, &unavailability);
            SlotResponse {
                id: s.id,
                doctor_id: s.doctor_id,
                slot_date: s.slot_date.to_string(),
                start_time: s.start_time.format("%H:%M").to_string(),
                end_time: s.end_time.format("%H:%M").to_string(),
                is_booked: s.is_booked,
                is_blocked: blocked,
            }
        })
        .collect();

    Ok(Json(response))
}

pub async fn get_all_availability(
    State(state): State<AppState>,
    Query(query): Query<AvailabilityQuery>,
) -> Result<Json<Vec<SlotWithDoctor>>, AppError> {
    let date = chrono::NaiveDate::parse_from_str(&query.date, "%Y-%m-%d")
        .map_err(|_| AppError::Validation("Invalid date format, use YYYY-MM-DD".to_string()))?;

    let rows = sqlx::query_as::<_, (Uuid, Uuid, chrono::NaiveDate, chrono::NaiveTime, chrono::NaiveTime, String, String, bool)>(
        "SELECT s.id, s.doctor_id, s.slot_date, s.start_time, s.end_time, d.first_name || ' ' || d.last_name, d.specialization, s.is_booked
         FROM availability_slots s
         JOIN doctors d ON d.id = s.doctor_id
         WHERE s.slot_date = $1
         ORDER BY s.doctor_id, s.start_time"
    )
    .bind(date)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    let blocked_times = load_blocked_times(&state, query.patient_id, date).await?;

    // Load all unavailability for all doctors on this date
    let all_unavailability = sqlx::query_as::<_, DoctorUnavailability>(
        "SELECT * FROM doctor_unavailability WHERE slot_date = $1"
    )
    .bind(date)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    // Group by doctor_id for fast lookup
    let mut unavail_by_doctor: std::collections::HashMap<Uuid, Vec<DoctorUnavailability>> = std::collections::HashMap::new();
    for u in all_unavailability {
        unavail_by_doctor.entry(u.doctor_id).or_default().push(u);
    }

    let slots = rows
        .into_iter()
        .map(|(id, doctor_id, slot_date, start_time, end_time, doctor_name, specialization, is_booked)| {
            let unavail = unavail_by_doctor.get(&doctor_id).map(|v| v.as_slice()).unwrap_or(&[]);
            let blocked = is_booked
                || is_blocked(start_time, &blocked_times, state.min_gap_minutes())
                || is_unavailable(start_time, unavail);
            SlotWithDoctor {
                id,
                doctor_id,
                slot_date: slot_date.to_string(),
                start_time: start_time.format("%H:%M").to_string(),
                end_time: end_time.format("%H:%M").to_string(),
                doctor_name,
                specialization,
                is_booked,
                is_blocked: blocked,
            }
        })
        .collect();

    Ok(Json(slots))
}

#[derive(Deserialize)]
pub struct MaxDateQuery {
    pub doctor_id: Option<Uuid>,
}

#[derive(Serialize)]
pub struct MaxDateResponse {
    pub max_date: Option<String>,
}

pub async fn get_max_availability_date(
    State(state): State<AppState>,
    Query(query): Query<MaxDateQuery>,
) -> Result<Json<MaxDateResponse>, AppError> {
    let min_advance = state.min_advance_days();
    let cutoff = chrono::Utc::now().date_naive() + chrono::Duration::days(min_advance);
    let row = if let Some(did) = query.doctor_id {
        sqlx::query_as::<_, (Option<chrono::NaiveDate>,)>(
            "SELECT MAX(slot_date) FROM availability_slots s
             WHERE s.doctor_id = $1 AND s.slot_date >= $2 AND NOT s.is_booked
             AND NOT EXISTS (
                 SELECT 1 FROM doctor_unavailability u
                 WHERE u.doctor_id = $1 AND u.slot_date = s.slot_date AND u.start_time IS NULL
             )"
        )
        .bind(did)
        .bind(cutoff)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| AppError::Database(e))?
    } else {
        sqlx::query_as::<_, (Option<chrono::NaiveDate>,)>(
            "SELECT MAX(slot_date) FROM availability_slots WHERE slot_date >= $1 AND NOT is_booked"
        )
        .bind(cutoff)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| AppError::Database(e))?
    };

    Ok(Json(MaxDateResponse {
        max_date: row.0.map(|d| d.to_string()),
    }))
}

#[derive(Deserialize)]
pub struct AvailableDatesQuery {
    pub doctor_id: Option<Uuid>,
}

#[derive(Serialize)]
pub struct AvailableDatesResponse {
    pub dates: Vec<String>,
}

pub async fn get_available_dates(
    State(state): State<AppState>,
    Query(query): Query<AvailableDatesQuery>,
) -> Result<Json<AvailableDatesResponse>, AppError> {
    let min_advance = state.min_advance_days();
    let cutoff = chrono::Utc::now().date_naive() + chrono::Duration::days(min_advance);
    let rows = if let Some(did) = query.doctor_id {
        sqlx::query_as::<_, (chrono::NaiveDate,)>(
            "SELECT DISTINCT s.slot_date FROM availability_slots s
             WHERE s.doctor_id = $1 AND s.slot_date >= $2 AND NOT s.is_booked
             AND NOT EXISTS (
                 SELECT 1 FROM doctor_unavailability u
                 WHERE u.doctor_id = $1 AND u.slot_date = s.slot_date AND u.start_time IS NULL
             )
             ORDER BY s.slot_date"
        )
        .bind(did)
        .bind(cutoff)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| AppError::Database(e))?
    } else {
        sqlx::query_as::<_, (chrono::NaiveDate,)>(
            "SELECT DISTINCT slot_date FROM availability_slots WHERE slot_date >= $1 AND NOT is_booked ORDER BY slot_date"
        )
        .bind(cutoff)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| AppError::Database(e))?
    };

    Ok(Json(AvailableDatesResponse {
        dates: rows.into_iter().map(|(d,)| d.to_string()).collect(),
    }))
}

// --- Doctor CRUD ---

#[derive(Deserialize)]
pub struct CreateDoctorRequest {
    pub first_name: String,
    pub last_name: String,
    pub specialization: String,
    pub email: String,
    pub phone: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateDoctorRequest {
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub specialization: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct DoctorFull {
    pub id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub specialization: String,
    pub email: String,
    pub phone: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub async fn get_doctor(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(doctor_id): Path<Uuid>,
) -> Result<Json<DoctorFull>, AppError> {
    require_role(&auth, &["admin", "scheduler"])?;
    let doctor = sqlx::query_as::<_, DoctorFull>(
        "SELECT * FROM doctors WHERE id = $1"
    )
    .bind(doctor_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?
    .ok_or_else(|| AppError::NotFound("Doctor not found".to_string()))?;
    Ok(Json(doctor))
}

pub async fn create_doctor(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreateDoctorRequest>,
) -> Result<Json<DoctorFull>, AppError> {
    state.check_mutation_rate_limit(&format!("create_doctor:{}", auth.sub))?;
    require_role(&auth, &["admin"])?;

    let first_name = body.first_name.trim().to_string();
    let last_name = body.last_name.trim().to_string();
    let specialization = body.specialization.trim().to_string();
    let email = body.email.trim().to_lowercase();

    if first_name.is_empty() || last_name.is_empty() || specialization.is_empty() || email.is_empty() {
        return Err(AppError::Validation("First name, last name, specialization, and email are required".to_string()));
    }

    validate_length(&first_name, "First name", 100)?;
    validate_length(&last_name, "Last name", 100)?;
    validate_length(&specialization, "Specialization", 255)?;
    validate_length(&email, "Email", 255)?;

    let doctor = sqlx::query_as::<_, DoctorFull>(
        "INSERT INTO doctors (first_name, last_name, specialization, email, phone)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *"
    )
    .bind(&first_name)
    .bind(&last_name)
    .bind(&specialization)
    .bind(&email)
    .bind(&body.phone)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref db_err) = e {
            if db_err.constraint() == Some("doctors_email_key") {
                return AppError::Conflict("A doctor with this email already exists".to_string());
            }
        }
        AppError::Database(e)
    })?;

    Ok(Json(doctor))
}

pub async fn update_doctor(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(doctor_id): Path<Uuid>,
    Json(body): Json<UpdateDoctorRequest>,
) -> Result<Json<DoctorFull>, AppError> {
    state.check_mutation_rate_limit(&format!("update_doctor:{}", auth.sub))?;
    require_role(&auth, &["admin"])?;

    let current = sqlx::query_as::<_, DoctorFull>(
        "SELECT * FROM doctors WHERE id = $1"
    )
    .bind(doctor_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?
    .ok_or_else(|| AppError::NotFound("Doctor not found".to_string()))?;

    let first_name = body.first_name.map(|v| v.trim().to_string()).filter(|v| !v.is_empty()).unwrap_or(current.first_name);
    let last_name = body.last_name.map(|v| v.trim().to_string()).filter(|v| !v.is_empty()).unwrap_or(current.last_name);
    let specialization = body.specialization.map(|v| v.trim().to_string()).filter(|v| !v.is_empty()).unwrap_or(current.specialization);
    let email = body.email.map(|v| v.trim().to_lowercase()).filter(|v| !v.is_empty()).unwrap_or(current.email);
    let phone = body.phone.or(current.phone);

    validate_length(&first_name, "First name", 100)?;
    validate_length(&last_name, "Last name", 100)?;
    validate_length(&specialization, "Specialization", 255)?;
    validate_length(&email, "Email", 255)?;

    let doctor = sqlx::query_as::<_, DoctorFull>(
        "UPDATE doctors SET first_name = $1, last_name = $2, specialization = $3, email = $4, phone = $5
         WHERE id = $6 RETURNING *"
    )
    .bind(&first_name)
    .bind(&last_name)
    .bind(&specialization)
    .bind(&email)
    .bind(&phone)
    .bind(doctor_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    Ok(Json(doctor))
}

pub async fn delete_doctor(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(doctor_id): Path<Uuid>,
) -> Result<Json<&'static str>, AppError> {
    state.check_mutation_rate_limit(&format!("delete_doctor:{}", auth.sub))?;
    require_role(&auth, &["admin"])?;

    let result = sqlx::query("DELETE FROM doctors WHERE id = $1")
        .bind(doctor_id)
        .execute(&state.pool)
        .await
        .map_err(|e| AppError::Database(e))?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Doctor not found".to_string()));
    }

    Ok(Json("deleted"))
}

// --- Doctor Schedules ---

#[derive(Deserialize)]
pub struct ScheduleEntry {
    pub day_of_week: i16,
    pub start_time: String,
    pub end_time: String,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct DoctorSchedule {
    pub id: Uuid,
    pub doctor_id: Uuid,
    pub day_of_week: i16,
    pub start_time: String,
    pub end_time: String,
}

pub async fn get_doctor_schedules(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(doctor_id): Path<Uuid>,
) -> Result<Json<Vec<DoctorSchedule>>, AppError> {
    require_role(&auth, &["admin", "scheduler"])?;
    let rows = sqlx::query_as::<_, (Uuid, Uuid, i16, String, String)>(
        "SELECT id, doctor_id, day_of_week, start_time::text, end_time::text FROM doctor_schedules WHERE doctor_id = $1 ORDER BY day_of_week"
    )
    .bind(doctor_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    Ok(Json(rows.into_iter().map(|(id, did, dow, st, et)| DoctorSchedule { id, doctor_id: did, day_of_week: dow, start_time: st, end_time: et }).collect()))
}

pub async fn set_doctor_schedules(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(doctor_id): Path<Uuid>,
    Json(body): Json<Vec<ScheduleEntry>>,
) -> Result<Json<Vec<DoctorSchedule>>, AppError> {
    state.check_mutation_rate_limit(&format!("set_doctor_schedules:{}", auth.sub))?;
    require_role(&auth, &["admin", "scheduler"])?;

    // Validate entries
    for entry in &body {
        if entry.day_of_week < 0 || entry.day_of_week > 6 {
            return Err(AppError::Validation("day_of_week must be between 0 (Monday) and 6 (Sunday)".to_string()));
        }
        chrono::NaiveTime::parse_from_str(&entry.start_time, "%H:%M")
            .map_err(|_| AppError::Validation("Invalid start_time format, use HH:MM".to_string()))?;
        chrono::NaiveTime::parse_from_str(&entry.end_time, "%H:%M")
            .map_err(|_| AppError::Validation("Invalid end_time format, use HH:MM".to_string()))?;
    }

    // Replace all schedules for this doctor in a transaction
    let mut tx = state.pool.begin().await.map_err(|e| AppError::Database(e))?;

    sqlx::query("DELETE FROM doctor_schedules WHERE doctor_id = $1")
        .bind(doctor_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(e))?;

    for entry in &body {
        sqlx::query(
            "INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3::time, $4::time)"
        )
        .bind(doctor_id)
        .bind(entry.day_of_week)
        .bind(&entry.start_time)
        .bind(&entry.end_time)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Database(e))?;
    }

    tx.commit().await.map_err(|e| AppError::Database(e))?;

    // Return updated schedules
    let rows = sqlx::query_as::<_, (Uuid, Uuid, i16, String, String)>(
        "SELECT id, doctor_id, day_of_week, start_time::text, end_time::text FROM doctor_schedules WHERE doctor_id = $1 ORDER BY day_of_week"
    )
    .bind(doctor_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    Ok(Json(rows.into_iter().map(|(id, did, dow, st, et)| DoctorSchedule { id, doctor_id: did, day_of_week: dow, start_time: st, end_time: et }).collect()))
}

pub fn doctor_routes() -> Router<AppState> {
    Router::new()
        .route("/api/doctors", get(list_doctors).post(create_doctor))
        .route("/api/doctors/:id", get(get_doctor).put(update_doctor).delete(delete_doctor))
        .route("/api/doctors/:id/availability", get(get_availability))
        .route("/api/doctors/:id/schedules", get(get_doctor_schedules).put(set_doctor_schedules))
        .route("/api/availability", get(get_all_availability))
        .route("/api/availability/max-date", get(get_max_availability_date))
        .route("/api/availability/dates", get(get_available_dates))
}
