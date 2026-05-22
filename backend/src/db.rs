use anyhow::Result;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use tracing::info;

pub async fn connect() -> Result<PgPool> {
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await?;

    info!("Database connection pool created");

    // Run migrations automatically
    sqlx::migrate!("./migrations").run(&pool).await?;
    info!("Database migrations applied");

    Ok(pool)
}
