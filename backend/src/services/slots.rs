use chrono::{NaiveTime, Datelike, Duration};
use sqlx::{PgPool, QueryBuilder};
use tracing::info;

use crate::error::AppError;
use crate::services::SettingsService;

const DAY_NAMES: [&str; 7] = [
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
];

pub async fn generate_slots(pool: &PgPool, settings: &SettingsService) -> Result<(), AppError> {
    let doctors = sqlx::query_as::<_, (uuid::Uuid,)>("SELECT id FROM doctors")
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Database(e))?;

    if doctors.is_empty() {
        return Ok(());
    }

    let duration_minutes: i64 = settings.get("appointment", "slot_duration_minutes").await.ok().flatten()
        .and_then(|v| v.parse().ok())
        .unwrap_or(30);

    let days_ahead: i64 = settings.get("appointment", "slot_days_ahead").await.ok().flatten()
        .and_then(|v| v.parse().ok())
        .unwrap_or(14);

    let mut day_hours: [Option<(NaiveTime, NaiveTime)>; 7] = Default::default();
    for (i, day) in DAY_NAMES.iter().enumerate() {
        let start_str = settings.get("appointment", &format!("{}_start", day)).await.ok().flatten()
            .unwrap_or_default();
        if start_str.is_empty() {
            day_hours[i] = None;
            continue;
        }
        let end_str = settings.get("appointment", &format!("{}_end", day)).await.ok().flatten()
            .unwrap_or_default();
        let start = NaiveTime::parse_from_str(&start_str, "%H:%M").ok();
        let end = NaiveTime::parse_from_str(&end_str, "%H:%M").ok();
        day_hours[i] = match (start, end) {
            (Some(s), Some(e)) => Some((s, e)),
            _ => None,
        };
    }

    let today = chrono::Utc::now().date_naive();
    let start_date = today + Duration::days(1);
    let end_date = today + Duration::days(days_ahead);

    // Trim unbooked slots beyond the window (skip slots still referenced by any appointment)
    sqlx::query(
        "DELETE FROM availability_slots WHERE slot_date > $1 AND is_booked = FALSE
         AND NOT EXISTS (SELECT 1 FROM appointments WHERE slot_id = availability_slots.id)"
    )
    .bind(end_date)
    .execute(pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    let dur_min = duration_minutes;
    let mut current = start_date;

    while current <= end_date {
        let day_idx = current.weekday().num_days_from_monday() as usize;

        match day_hours[day_idx] {
            None => {
                sqlx::query(
                    "DELETE FROM availability_slots WHERE slot_date = $1 AND is_booked = FALSE
                     AND NOT EXISTS (SELECT 1 FROM appointments WHERE slot_id = availability_slots.id)"
                )
                .bind(current)
                .execute(pool)
                .await
                .map_err(|e| AppError::Database(e))?;
            }
            Some((start, end)) => {
                // Clear unbooked slots for this day (skip slots still referenced by any appointment)
                sqlx::query(
                    "DELETE FROM availability_slots WHERE slot_date = $1 AND is_booked = FALSE
                     AND NOT EXISTS (SELECT 1 FROM appointments WHERE slot_id = availability_slots.id)"
                )
                .bind(current)
                .execute(pool)
                .await
                .map_err(|e| AppError::Database(e))?;

                // Build time pairs
                let mut times: Vec<(NaiveTime, NaiveTime)> = Vec::new();
                let mut t = start;
                while t + Duration::minutes(dur_min) <= end {
                    times.push((t, t + Duration::minutes(dur_min)));
                    t = t + Duration::minutes(dur_min);
                }

                if times.is_empty() {
                    current += Duration::days(1);
                    continue;
                }

                // Single bulk INSERT per day per doctor
                for (doctor_id,) in &doctors {
                    let mut qb = QueryBuilder::new(
                        "INSERT INTO availability_slots (doctor_id, slot_date, start_time, end_time) "
                    );
                    qb.push_values(times.iter(), |mut b, (st, et)| {
                        b.push_bind(doctor_id)
                            .push_bind(current)
                            .push_bind(st)
                            .push_bind(et);
                    });
                    qb.push(" ON CONFLICT (doctor_id, slot_date, start_time) DO NOTHING");
                    qb.build().execute(pool).await.map_err(|e| AppError::Database(e))?;
                }
            }
        }

        current += Duration::days(1);
    }

    info!(
        "Slots generated: {} days ({} ahead), {} min slots, {} doctors",
        days_ahead, days_ahead, duration_minutes, doctors.len()
    );

    Ok(())
}
