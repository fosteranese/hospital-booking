use anyhow::Result;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use tracing::info;

const STATEMENT_TIMEOUT: &str = "SET statement_timeout = '30s'";

pub async fn connect() -> Result<PgPool> {
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");

    let pool = PgPoolOptions::new()
        .max_connections(20)
        .connect(&database_url)
        .await?;

    sqlx::query(STATEMENT_TIMEOUT).execute(&pool).await?;

    info!("Database connection pool created (max 20)");

    // Run migrations automatically
    sqlx::migrate!("./migrations").run(&pool).await?;
    info!("Database migrations applied");

    Ok(pool)
}
