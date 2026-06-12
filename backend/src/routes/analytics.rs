use axum::{Json, Router, extract::State, routing::get};
use serde::Serialize;

use crate::error::AppError;
use crate::middleware::auth::{AuthUser, require_role};
use crate::state::AppState;

#[derive(Serialize)]
pub struct AnalyticsOverview {
    pub total_appointments: i64,
    pub confirmed: i64,
    pub cancelled: i64,
    pub attended: i64,
    pub missed: i64,
    pub today_total: i64,
    pub today_confirmed: i64,
    pub total_patients: i64,
    pub total_doctors: i64,
}

#[derive(Serialize)]
pub struct DoctorStat {
    pub doctor_id: String,
    pub doctor_name: String,
    pub specialization: String,
    pub total_appointments: i64,
    pub attended: i64,
    pub missed: i64,
    pub cancelled: i64,
    pub upcoming: i64,
}

pub async fn analytics_overview(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<AnalyticsOverview>, AppError> {
    require_role(&auth, &["admin", "scheduler"])?;

    let (total_appointments, cancelled, attended, missed, confirmed, today_total, today_confirmed): (i64, i64, i64, i64, i64, i64, i64) = sqlx::query_as(
        "SELECT
            COUNT(*) AS total_appointments,
            COUNT(*) FILTER (WHERE a.status = 'cancelled') AS cancelled,
            COUNT(*) FILTER (WHERE a.attended = true) AS attended,
            COUNT(*) FILTER (WHERE a.attended = false) AS missed,
            COUNT(*) FILTER (WHERE a.status = 'confirmed' AND s.slot_date >= CURRENT_DATE) AS confirmed,
            COUNT(*) FILTER (WHERE s.slot_date = CURRENT_DATE) AS today_total,
            COUNT(*) FILTER (WHERE a.status = 'confirmed' AND s.slot_date = CURRENT_DATE) AS today_confirmed
         FROM appointments a
         LEFT JOIN availability_slots s ON s.id = a.slot_id"
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    let total_patients: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM patients")
        .fetch_one(&state.pool).await.map_err(|e| AppError::Database(e))?;

    let total_doctors: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM doctors")
        .fetch_one(&state.pool).await.map_err(|e| AppError::Database(e))?;

    Ok(Json(AnalyticsOverview {
        total_appointments, confirmed, cancelled, attended, missed,
        today_total, today_confirmed, total_patients, total_doctors,
    }))
}

pub async fn doctor_stats(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<DoctorStat>>, AppError> {
    require_role(&auth, &["admin", "scheduler"])?;

    let rows = sqlx::query_as::<_, (String, String, String, i64, i64, i64, i64, i64)>(
        "SELECT d.id::text, d.first_name || ' ' || d.last_name, d.specialization,
                COALESCE(s.total, 0), COALESCE(s.attended, 0), COALESCE(s.missed, 0), COALESCE(s.cancelled, 0), COALESCE(s.upcoming, 0)
         FROM doctors d
         LEFT JOIN LATERAL (
             SELECT
                 COUNT(*) AS total,
                 COUNT(*) FILTER (WHERE a.attended = true) AS attended,
                 COUNT(*) FILTER (WHERE a.attended = false) AS missed,
                 COUNT(*) FILTER (WHERE a.status = 'cancelled') AS cancelled,
                 COUNT(*) FILTER (WHERE a.status = 'confirmed' AND sl.slot_date >= CURRENT_DATE) AS upcoming
             FROM appointments a
             JOIN availability_slots sl ON sl.id = a.slot_id
             WHERE a.doctor_id = d.id
         ) s ON true
         ORDER BY d.first_name"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    Ok(Json(rows.into_iter().map(|(id, name, spec, total, attended, missed, cancelled, upcoming)| {
        DoctorStat {
            doctor_id: id, doctor_name: name, specialization: spec,
            total_appointments: total, attended, missed, cancelled, upcoming,
        }
    }).collect()))
}

pub fn analytics_routes() -> Router<AppState> {
    Router::new()
        .route("/api/analytics/overview", get(analytics_overview))
        .route("/api/analytics/doctor-stats", get(doctor_stats))
}
