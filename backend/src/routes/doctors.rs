use axum::{
    Json, extract::{Path, Query, State}, Router, routing::get,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;
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
                || is_blocked(s.start_time, &blocked_times, *state.min_gap_minutes.read().unwrap())
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
                || is_blocked(start_time, &blocked_times, *state.min_gap_minutes.read().unwrap())
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
    let min_advance = *state.min_advance_days.read().unwrap();
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
    let min_advance = *state.min_advance_days.read().unwrap();
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

pub fn doctor_routes() -> Router<AppState> {
    Router::new()
        .route("/api/doctors", get(list_doctors))
        .route("/api/doctors/:id/availability", get(get_availability))
        .route("/api/availability", get(get_all_availability))
        .route("/api/availability/max-date", get(get_max_availability_date))
        .route("/api/availability/dates", get(get_available_dates))
}
