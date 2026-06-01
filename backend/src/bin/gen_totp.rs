use std::env;
use totp_rs::{TOTP, Secret, Algorithm};

const ISSUER: &str = "HospitalBooking";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = sqlx::PgPool::connect(&database_url).await?;

    let dev_users = vec![
        ("admin@hospital.com", "Admin"),
        ("doctor@hospital.com", "Doctor"),
        ("scheduler@hospital.com", "Scheduler"),
    ];

    for (email, label) in &dev_users {
        let secret = Secret::generate_secret();
        let secret_bytes = secret.to_bytes().map_err(|e| format!("{:?}", e))?;
        let totp = TOTP::new(
            Algorithm::SHA1, 6, 1, 30, secret_bytes,
            Some(ISSUER.to_string()), email.to_string(),
        ).map_err(|e| format!("{}", e))?;

        let secret_base32 = totp.get_secret_base32();
        let otpauth_url = totp.get_url();

        sqlx::query("UPDATE users SET mfa_secret = $1 WHERE identifier = $2")
            .bind(&secret_base32)
            .bind(email)
            .execute(&pool)
            .await?;

        println!("=== {} ({}) ===", label, email);
        println!("Secret:      {}", secret_base32);
        println!("OTPAuth URL: {}", otpauth_url);
        println!();
    }

    println!("Done. TOTP secrets updated for all dev users.");
    Ok(())
}
