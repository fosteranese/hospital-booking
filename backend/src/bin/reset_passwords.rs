use std::env;
use bcrypt::{hash, DEFAULT_COST};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = sqlx::PgPool::connect(&database_url).await?;

    let password = "staff1234";
    let hash = hash(password, DEFAULT_COST)?;

    let users = vec![
        "admin@hospital.com",
        "doctor@hospital.com",
        "scheduler@hospital.com",
    ];

    for user in users {
        sqlx::query("UPDATE users SET password_hash = $1 WHERE identifier = $2")
            .bind(&hash)
            .bind(user)
            .execute(&pool)
            .await?;
        println!("Reset password for {}", user);
    }

    println!("\nAll passwords reset to: {}", password);
    Ok(())
}
