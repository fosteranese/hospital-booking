use std::sync::{Arc, RwLock};
use axum::{Router, body::Body, http::Response};
use tower_http::cors::{CorsLayer, Any};
use tower_http::trace::TraceLayer;
use tracing_subscriber::EnvFilter;
use std::time::Duration;
use tracing::Span;

mod db;
mod error;
mod middleware;
mod models;
mod routes;
mod services;
mod state;

use crate::state::AppState;
use crate::services::{EmailService, SettingsService, SmsService, generate_slots};

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    let pool = db::connect().await.expect("Failed to connect to database");

    let encryption_key = std::env::var("SETTINGS_ENCRYPTION_KEY")
        .expect("SETTINGS_ENCRYPTION_KEY must be set (64 hex chars = 32 bytes)");

    let settings = SettingsService::new(pool.clone(), &encryption_key)
        .expect("Failed to initialize settings service");

    settings.seed_defaults().await.expect("Failed to seed settings");

    // Generate initial slots
    generate_slots(&pool, &settings).await.expect("Failed to generate slots");

    // Background task: keep slots fresh and clean stale blacklist entries every hour
    let bg_pool = pool.clone();
    let bg_settings = settings.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(3600)).await;
            let _ = sqlx::query("DELETE FROM token_blacklist WHERE expires_at <= NOW()")
                .execute(&bg_pool)
                .await;
            if let Err(e) = generate_slots(&bg_pool, &bg_settings).await {
                tracing::error!("Background slot generation failed: {:?}", e);
            }
        }
    });

    let smtp_host = settings.get("smtp", "host").await.ok().flatten();
    let smtp_user = settings.get("smtp", "user").await.ok().flatten();
    let smtp_pass = settings.get("smtp", "pass").await.ok().flatten();
    let from_email = settings.get("smtp", "from_email").await.ok().flatten()
        .unwrap_or_else(|| "noreply@hospital.com".to_string());

    let email_service = EmailService::new(smtp_host, smtp_user, smtp_pass, from_email);
    let sms_service = SmsService::new();

    let jwt_secret = std::env::var("JWT_SECRET")
        .expect("JWT_SECRET must be set");

    let min_gap_minutes: i64 = settings.get("appointment", "min_gap_minutes").await.ok().flatten()
        .and_then(|v| v.parse().ok())
        .unwrap_or(180);

    let min_advance_days: i64 = settings.get("appointment", "min_advance_days").await.ok().flatten()
        .and_then(|v| v.parse().ok())
        .unwrap_or(7);

    let max_upcoming_appointments: i64 = settings.get("appointment", "max_upcoming_appointments").await.ok().flatten()
        .and_then(|v| v.parse().ok())
        .unwrap_or(3);

    let clinic_name = settings.get("appointment", "clinic_name").await.ok().flatten()
        .unwrap_or_else(|| "MEDIPORT FERTILITY SERVICES".to_string());

    let clinic_address = settings.get("appointment", "clinic_address").await.ok().flatten()
        .unwrap_or_else(|| "Bissau Avenue, East-Legon, Accra, Ghana".to_string());

    let state = AppState {
        pool,
        email_service: Arc::new(email_service),
        sms_service: Arc::new(sms_service),
        jwt_secret,
        min_gap_minutes: Arc::new(RwLock::new(min_gap_minutes)),
        min_advance_days: Arc::new(RwLock::new(min_advance_days)),
        max_upcoming_appointments: Arc::new(RwLock::new(max_upcoming_appointments)),
        clinic_name: Arc::new(RwLock::new(clinic_name)),
        clinic_address: Arc::new(RwLock::new(clinic_address)),
        settings,
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .merge(routes::auth::auth_routes())
        .merge(routes::patients::patient_routes())
        .merge(routes::doctors::doctor_routes())
        .merge(routes::appointments::appointment_routes())
        .merge(routes::settings::settings_routes())
        .merge(routes::unavailability::unavailability_routes())
        .layer(cors)
        .layer(
            TraceLayer::new_for_http()
                .on_response(|response: &Response<Body>, latency: Duration, _span: &Span| {
                    let status = response.status();
                    if status.is_server_error() {
                        tracing::error!(status = status.as_u16(), latency_ms = latency.as_millis(), "internal error");
                    } else if status.is_client_error() {
                        tracing::warn!(status = status.as_u16(), latency_ms = latency.as_millis(), "bad request");
                    } else {
                        tracing::info!(status = status.as_u16(), latency_ms = latency.as_millis(), "request completed");
                    }
                }),
        )
        .with_state(state);

    let addr = "0.0.0.0:3000";
    tracing::info!("Server starting on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
