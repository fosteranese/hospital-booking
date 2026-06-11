use axum::{
    Json, Router,
    extract::State,
    routing::get,
};
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::AuthUser;
use crate::state::AppState;

#[derive(Debug, Serialize, FromRow)]
pub struct ReferralItem {
    pub id: Uuid,
    pub patient_name: String,
    pub patient_email: String,
    pub doctor_id: Uuid,
    pub doctor_name: String,
    pub referring_doctor_id: Uuid,
    pub referring_doctor_name: String,
    pub slot_date: chrono::NaiveDate,
    pub start_time: chrono::NaiveTime,
    pub end_time: chrono::NaiveTime,
    pub status: String,
    pub notes: String,
    pub attended: Option<bool>,
    pub arrival_time: Option<chrono::DateTime<chrono::Utc>>,
    pub cancellation_reason: String,
}

pub async fn list_referrals(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<ReferralItem>>, AppError> {
    if auth.role == "patient" {
        return Err(AppError::Unauthorized("Patients cannot view referrals".to_string()));
    }

    let rows = if auth.role == "doctor" {
        // Doctors see only referrals they made
        let doctor_id = sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM doctors WHERE email = $1"
        )
        .bind(&auth.sub)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| AppError::Database(e))?
        .ok_or_else(|| AppError::Unauthorized("Doctor profile not found".to_string()))?;

        sqlx::query_as::<_, ReferralItem>(
            "SELECT a.id, \
             p.first_name || ' ' || p.last_name AS patient_name, \
             p.email AS patient_email, \
             a.doctor_id, \
             d.first_name || ' ' || d.last_name AS doctor_name, \
             a.referring_doctor_id, \
             rd.first_name || ' ' || rd.last_name AS referring_doctor_name, \
             s.slot_date, s.start_time, s.end_time, \
              a.status, a.notes, CASE WHEN a.attended IS NULL AND s.slot_date < CURRENT_DATE AND a.status != 'cancelled' THEN false ELSE a.attended END AS attended, a.arrival_time, a.cancellation_reason \
               FROM appointments a \
               JOIN patients p ON p.id = a.patient_id \
               JOIN doctors d ON d.id = a.doctor_id \
               JOIN doctors rd ON rd.id = a.referring_doctor_id \
               JOIN availability_slots s ON s.id = a.slot_id \
               WHERE a.referring_doctor_id IS NOT NULL \
                 AND a.referring_doctor_id = $1 \
             ORDER BY s.slot_date DESC, s.start_time DESC"
        )
        .bind(doctor_id)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| AppError::Database(e))?
    } else {
        // Admin/scheduler see all referrals
        sqlx::query_as::<_, ReferralItem>(
            "SELECT a.id, \
             p.first_name || ' ' || p.last_name AS patient_name, \
             p.email AS patient_email, \
             a.doctor_id, \
             d.first_name || ' ' || d.last_name AS doctor_name, \
             a.referring_doctor_id, \
             rd.first_name || ' ' || rd.last_name AS referring_doctor_name, \
             s.slot_date, s.start_time, s.end_time, \
              a.status, a.notes, CASE WHEN a.attended IS NULL AND s.slot_date < CURRENT_DATE AND a.status != 'cancelled' THEN false ELSE a.attended END AS attended, a.arrival_time, a.cancellation_reason \
               FROM appointments a \
               JOIN patients p ON p.id = a.patient_id \
               JOIN doctors d ON d.id = a.doctor_id \
               JOIN doctors rd ON rd.id = a.referring_doctor_id \
               JOIN availability_slots s ON s.id = a.slot_id \
               WHERE a.referring_doctor_id IS NOT NULL \
             ORDER BY s.slot_date DESC, s.start_time DESC"
        )
        .fetch_all(&state.pool)
        .await
        .map_err(|e| AppError::Database(e))?
    };

    Ok(Json(rows))
}

pub fn referral_routes() -> Router<AppState> {
    Router::new()
        .route("/api/referrals", get(list_referrals))
}
