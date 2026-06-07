use sqlx::PgPool;

pub async fn mark_missed_appointments(pool: &PgPool) -> Result<u64, sqlx::Error> {
    let result = sqlx::query(
        "UPDATE appointments
         SET attended = false, updated_at = NOW()
         WHERE slot_id IN (SELECT id FROM availability_slots WHERE slot_date < CURRENT_DATE)
           AND attended IS NULL
           AND status != 'cancelled'"
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}
