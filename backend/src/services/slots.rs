use std::collections::HashMap;
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

    // Batch-load all appointment settings in one query
    let appt_settings = settings.get_group("appointment").await?;
    let mut map: HashMap<String, String> = HashMap::new();
    for s in appt_settings {
        if let Some(v) = s.value {
            map.insert(s.name, v);
        }
    }

    let duration_minutes: i64 = map.get("slot_duration_minutes")
        .and_then(|v| v.parse().ok())
        .unwrap_or(30);

    let days_ahead: i64 = map.get("slot_days_ahead")
        .and_then(|v| v.parse().ok())
        .unwrap_or(14);

    let mut day_hours: [Option<(NaiveTime, NaiveTime)>; 7] = Default::default();
    for (i, day) in DAY_NAMES.iter().enumerate() {
        let start_str = map.get(&format!("{}_start", day)).map(|s| s.as_str()).unwrap_or("");
        if start_str.is_empty() {
            day_hours[i] = None;
            continue;
        }
        let end_str = map.get(&format!("{}_end", day)).map(|s| s.as_str()).unwrap_or("");
        let start = NaiveTime::parse_from_str(start_str, "%H:%M").ok();
        let end = NaiveTime::parse_from_str(end_str, "%H:%M").ok();
        day_hours[i] = match (start, end) {
            (Some(s), Some(e)) => Some((s, e)),
            _ => None,
        };
    }

    let today = chrono::Utc::now().date_naive();
    let start_date = today + Duration::days(1);
    let end_date = today + Duration::days(days_ahead);

    // Trim unbooked slots beyond the window
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
                sqlx::query(
                    "DELETE FROM availability_slots WHERE slot_date = $1 AND is_booked = FALSE
                     AND NOT EXISTS (SELECT 1 FROM appointments WHERE slot_id = availability_slots.id)"
                )
                .bind(current)
                .execute(pool)
                .await
                .map_err(|e| AppError::Database(e))?;

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
