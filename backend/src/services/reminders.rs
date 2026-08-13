use sqlx::PgPool;
use crate::state::AppState;

#[derive(sqlx::FromRow)]
struct ReminderRow {
    appointment_id: uuid::Uuid,
    patient_email: String,
    patient_first_name: String,
    doctor_first_name: String,
    doctor_last_name: String,
    slot_date: chrono::NaiveDate,
    start_time: chrono::NaiveTime,
}

// Audit finding #3 (follow-up UX comparison): the system tracked
// attended/minutes_late per appointment (i.e. no-shows were clearly already
// a metric someone here cares about) but had no reminder mechanism to help
// prevent them in the first place -- only a booking-time confirmation email.
// This sweeps for appointments landing in a ~1-hour window centered 24 hours
// out, sends a reminder, and flags `reminder_sent` so it's never sent twice.
// Called from a background loop in main.rs, the same shape as
// mark_missed_appointments -- not from any request handler.
//
// NOW()::timestamp here is *not* server-local wall-clock time -- confirmed
// by logging it directly: this app's sqlx connections see NOW() in UTC,
// while an interactive `psql` session from a workstation with e.g. TZ=Europe/
// Berlin set applies a +02:00 session override libpq negotiates on connect
// (sqlx doesn't). That's fine and doesn't need fixing -- slot_date/start_time
// are themselves written by this same app via the same sqlx connections, so
// "NOW()" and "the stored slot time" are always compared using the same
// implicit frame of reference. It only matters if you're debugging this
// query by hand from psql: don't assume NOW() there matches what this
// function sees, check it (e.g. `SELECT NOW()::timestamp`) from the same
// connection path first.
pub async fn send_appointment_reminders(state: &AppState) -> Result<u64, sqlx::Error> {
    let pool: &PgPool = &state.pool;

    let rows = sqlx::query_as::<_, ReminderRow>(
        "SELECT a.id AS appointment_id, p.email AS patient_email, p.first_name AS patient_first_name,
                d.first_name AS doctor_first_name, d.last_name AS doctor_last_name,
                s.slot_date, s.start_time
         FROM appointments a
         JOIN availability_slots s ON a.slot_id = s.id
         JOIN patients p ON a.patient_id = p.id
         JOIN doctors d ON a.doctor_id = d.id
         WHERE a.status != 'cancelled'
           AND a.reminder_sent = FALSE
           AND (s.slot_date + s.start_time) BETWEEN (NOW()::timestamp + INTERVAL '23 hours')
                                                  AND (NOW()::timestamp + INTERVAL '24 hours')"
    )
    .fetch_all(pool)
    .await?;

    let clinic_name = state.clinic_name();
    let mut sent = 0u64;

    for row in &rows {
        let subject = format!("Reminder: your appointment tomorrow at {}", clinic_name);
        let body = format!(
            "Hi {},\n\nThis is a reminder that you have an appointment tomorrow with Dr. {} {} at {}.\n\n\
             Date: {}\nTime: {}\n\nIf you need to reschedule or cancel, please contact us as soon as possible.",
            row.patient_first_name,
            row.doctor_first_name,
            row.doctor_last_name,
            clinic_name,
            row.slot_date,
            row.start_time.format("%H:%M"),
        );

        state.email_service.send_notification(&row.patient_email, &subject, &body).await;

        sqlx::query("UPDATE appointments SET reminder_sent = TRUE WHERE id = $1")
            .bind(row.appointment_id)
            .execute(pool)
            .await?;
        sent += 1;
    }

    Ok(sent)
}
