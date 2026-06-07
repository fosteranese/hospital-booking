use std::collections::HashMap;
use chrono::{NaiveTime, Datelike, Duration};
use sqlx::{PgPool, QueryBuilder};
use tracing::info;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::DoctorUnavailability;
use crate::services::SettingsService;

fn is_time_unavailable(t: NaiveTime, unavail: &[DoctorUnavailability]) -> bool {
    unavail.iter().any(|u| {
        if u.start_time.is_none() && u.end_time.is_none() {
            return true; // full-day off
        }
        if let (Some(st), Some(et)) = (u.start_time, u.end_time) {
            if t >= st && t < et {
                return true;
            }
        }
        false
    })
}

const DAY_NAMES: [&str; 7] = [
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
];

type DayHours = [Option<(NaiveTime, NaiveTime)>; 7];

fn get_day_hours_from_map(map: &HashMap<String, String>) -> DayHours {
    let mut day_hours: DayHours = Default::default();
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
    day_hours
}

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

    let min_advance_days: i64 = map.get("min_advance_days")
        .and_then(|v| v.parse().ok())
        .unwrap_or(7);

    let reschedule_days_ahead: i64 = map.get("reschedule_days_ahead")
        .and_then(|v| v.parse().ok())
        .unwrap_or(30);

    let default_day_hours = get_day_hours_from_map(&map);

    // Load per-doctor schedules
    let doctor_schedules: Vec<(Uuid, i16, String, String)> = sqlx::query_as::<_, (Uuid, i16, String, String)>(
        "SELECT doctor_id, day_of_week, start_time::text, end_time::text FROM doctor_schedules"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    // Index per-doctor schedules by (doctor_id, day_of_week) -> (start, end)
    let mut schedule_index: HashMap<(Uuid, i16), (NaiveTime, NaiveTime)> = HashMap::new();
    for (did, dow, st_str, et_str) in doctor_schedules {
        if let (Ok(st), Ok(et)) = (NaiveTime::parse_from_str(&st_str, "%H:%M"), NaiveTime::parse_from_str(&et_str, "%H:%M")) {
            schedule_index.insert((did, dow), (st, et));
        }
    }

    let today = chrono::Utc::now().date_naive();
    let start_date = today + Duration::days(min_advance_days);
    let normal_end_date = today + Duration::days(days_ahead);
    let reserve_end_date = today + Duration::days(reschedule_days_ahead);
    let generate_until = normal_end_date.max(reserve_end_date);

    // Batch-load all unavailability for the full generation window
    let all_unavailability: Vec<DoctorUnavailability> = sqlx::query_as::<_, DoctorUnavailability>(
        "SELECT * FROM doctor_unavailability WHERE slot_date >= $1 AND slot_date <= $2"
    )
    .bind(start_date)
    .bind(generate_until)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    // Index by (doctor_id, slot_date) for fast lookup
    let mut unavail_index: HashMap<(Uuid, chrono::NaiveDate), Vec<DoctorUnavailability>> = HashMap::new();
    for u in all_unavailability {
        unavail_index.entry((u.doctor_id, u.slot_date)).or_default().push(u);
    }

    // Trim unbooked slots beyond the full generation window
    sqlx::query(
        "DELETE FROM availability_slots WHERE (slot_date > $1 OR slot_date < $2) AND is_booked = FALSE
         AND NOT EXISTS (SELECT 1 FROM appointments WHERE slot_id = availability_slots.id)"
    )
    .bind(generate_until)
    .bind(start_date)
    .execute(pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    let dur_min = duration_minutes;
    let mut current = start_date;

    while current <= generate_until {
        let day_idx = current.weekday().num_days_from_monday() as i16;
        let is_reserve_range = current > normal_end_date;
        current += Duration::days(1);

        let slot_date = current - Duration::days(1);

        // Clean up old unbooked regular slots for this date
        sqlx::query(
            "DELETE FROM availability_slots WHERE slot_date = $1 AND is_booked = FALSE AND is_reserve = FALSE
             AND NOT EXISTS (SELECT 1 FROM appointments WHERE slot_id = availability_slots.id)"
        )
        .bind(slot_date)
        .execute(pool)
        .await
        .map_err(|e| AppError::Database(e))?;

        for (doctor_id,) in &doctors {
            let unavail_for_doc = unavail_index.get(&(*doctor_id, slot_date)).map(|v| v.as_slice()).unwrap_or(&[]);

            // If full-day off, skip this doctor entirely for this date
            if unavail_for_doc.iter().any(|u| u.start_time.is_none() && u.end_time.is_none()) {
                sqlx::query(
                    "DELETE FROM availability_slots WHERE doctor_id = $1 AND slot_date = $2 AND is_booked = FALSE
                     AND NOT EXISTS (SELECT 1 FROM appointments WHERE slot_id = availability_slots.id)"
                )
                .bind(doctor_id)
                .bind(slot_date)
                .execute(pool)
                .await
                .map_err(|e| AppError::Database(e))?;
                continue;
            }

            // Determine hours: per-doctor schedule overrides global defaults
            let day_hours = schedule_index.get(&(*doctor_id, day_idx))
                .copied()
                .or_else(|| default_day_hours[day_idx as usize]);

            let Some((start, end)) = day_hours else { continue; };

            let mut times: Vec<(NaiveTime, NaiveTime)> = Vec::new();
            let mut t = start;
            while t + Duration::minutes(dur_min) <= end {
                times.push((t, t + Duration::minutes(dur_min)));
                t = t + Duration::minutes(dur_min);
            }

            // Filter out time slots that fall within time-range unavailability
            let filtered_times: Vec<&(NaiveTime, NaiveTime)> = times.iter()
                .filter(|(st, _)| !is_time_unavailable(*st, unavail_for_doc))
                .collect();

            if filtered_times.is_empty() {
                continue;
            }

            // Demote any existing reserve slots within the non-reserve range
            if !is_reserve_range {
                sqlx::query(
                    "UPDATE availability_slots SET is_reserve = FALSE
                     WHERE doctor_id = $1 AND slot_date = $2 AND is_reserve = TRUE"
                )
                .bind(doctor_id)
                .bind(slot_date)
                .execute(pool)
                .await
                .map_err(|e| AppError::Database(e))?;
            }

            let mut qb = QueryBuilder::new(
                "INSERT INTO availability_slots (doctor_id, slot_date, start_time, end_time, is_reserve) "
            );
            qb.push_values(filtered_times.iter(), |mut b, (st, et)| {
                b.push_bind(doctor_id)
                    .push_bind(slot_date)
                    .push_bind(st)
                    .push_bind(et)
                    .push_bind(is_reserve_range);
            });
            qb.push(" ON CONFLICT (doctor_id, slot_date, start_time) DO NOTHING");
            qb.build().execute(pool).await.map_err(|e| AppError::Database(e))?;
        }
    }

    info!(
        "Slots generated: normal {} days, reserve {} days ({} ahead, {} min advance), {} min slots, {} doctors",
        days_ahead, reschedule_days_ahead, days_ahead, min_advance_days, duration_minutes, doctors.len()
    );

    Ok(())
}
