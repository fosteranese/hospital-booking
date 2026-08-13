use std::sync::{Arc, RwLock};
use axum::Router;
use axum::extract::DefaultBodyLimit;
use axum::routing::get;
use std::sync::Mutex;
use tower_http::compression::CompressionLayer;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::EnvFilter;
use std::time::Duration;

mod db;
mod error;
mod middleware;
mod models;
mod ratelimit;
mod routes;
mod services;
mod state;

use crate::state::AppState;
use crate::ratelimit::RateLimiter;
use crate::services::{EmailService, SettingsService, SmsService, generate_slots, mark_missed_appointments, send_appointment_reminders};

async fn health() -> &'static str {
    "OK"
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    let pool = match db::connect().await {
        Ok(p) => p,
        Err(e) => {
            tracing::error!("Failed to connect to database: {:?}", e);
            std::process::exit(1);
        }
    };

    let encryption_key = match std::env::var("SETTINGS_ENCRYPTION_KEY") {
        Ok(k) => k,
        Err(_) => {
            tracing::error!("SETTINGS_ENCRYPTION_KEY must be set (64 hex chars = 32 bytes)");
            std::process::exit(1);
        }
    };

    let settings = match SettingsService::new(pool.clone(), &encryption_key) {
        Ok(s) => s,
        Err(e) => {
            tracing::error!("Failed to initialize settings service: {:?}", e);
            std::process::exit(1);
        }
    };

    if let Err(e) = settings.seed_defaults().await {
        tracing::error!("Failed to seed settings: {:?}", e);
        std::process::exit(1);
    }

    // Generate slots in background so server starts immediately
    let init_pool = pool.clone();
    let init_settings = settings.clone();
    tokio::spawn(async move {
        match generate_slots(&init_pool, &init_settings).await {
            Ok(_) => tracing::info!("Initial slot generation complete"),
            Err(e) => tracing::error!("Initial slot generation failed: {:?}", e),
        }
    });

    // Seed admin user from environment variable
    if let Ok(admin_identifier) = std::env::var("ADMIN_IDENTIFIER") {
        let normalized = admin_identifier.trim().to_lowercase();
        if !normalized.is_empty() {
            let _ = sqlx::query(
                "INSERT INTO users (identifier, role) VALUES ($1, 'admin') ON CONFLICT (identifier) DO UPDATE SET role = 'admin'"
            )
            .bind(&normalized)
            .execute(&pool)
            .await;
            tracing::info!("Admin user seeded: {}", normalized);
        }
    }

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

    // Background task: auto-mark past appointments as missed every 5 minutes
    let missed_pool = pool.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(300)).await;
            match mark_missed_appointments(&missed_pool).await {
                Ok(count) => {
                    if count > 0 {
                        tracing::info!("Marked {} past appointments as missed", count);
                    }
                }
                Err(e) => tracing::error!("Failed to mark missed appointments: {:?}", e),
            }
        }
    });

    // Batch-load settings: 3 group queries instead of 10 individual queries
    let smtp_map: std::collections::HashMap<String, String> = settings.get_group("smtp").await
        .unwrap_or_default()
        .into_iter()
        .filter_map(|s| s.value.map(|v| (s.name, v)))
        .collect();

    let appt_map: std::collections::HashMap<String, String> = settings.get_group("appointment").await
        .unwrap_or_default()
        .into_iter()
        .filter_map(|s| s.value.map(|v| (s.name, v)))
        .collect();

    let clinic_map: std::collections::HashMap<String, String> = settings.get_group("clinic").await
        .unwrap_or_default()
        .into_iter()
        .filter_map(|s| s.value.map(|v| (s.name, v)))
        .collect();

    let smtp_host = smtp_map.get("host").cloned();
    let smtp_user = smtp_map.get("user").cloned();
    let smtp_pass = smtp_map.get("pass").cloned();
    let from_email = smtp_map.get("from_email").cloned()
        .unwrap_or_else(|| "noreply@hospital.com".to_string());

    let email_service = EmailService::new(smtp_host, smtp_user, smtp_pass, from_email);
    let sms_service = SmsService::new();

    let jwt_secret = match std::env::var("JWT_SECRET") {
        Ok(k) => {
            if k.len() < 32 {
                tracing::error!("JWT_SECRET must be at least 32 characters long (got {})", k.len());
                std::process::exit(1);
            }
            k
        }
        Err(_) => {
            tracing::error!("JWT_SECRET must be set");
            std::process::exit(1);
        }
    };

    let min_gap_minutes: i64 = appt_map.get("min_gap_minutes")
        .and_then(|v| v.parse().ok())
        .unwrap_or(180);

    let min_advance_days: i64 = appt_map.get("min_advance_days")
        .and_then(|v| v.parse().ok())
        .unwrap_or(7);

    let max_upcoming_appointments: i64 = appt_map.get("max_upcoming_appointments")
        .and_then(|v| v.parse().ok())
        .unwrap_or(3);

    let clinic_name = clinic_map.get("clinic_name").cloned()
        .unwrap_or_else(|| "MEDIPORT FERTILITY SERVICES".to_string());

    let clinic_address = clinic_map.get("clinic_address").cloned()
        .unwrap_or_else(|| "Bissau Avenue, East-Legon, Accra, Ghana".to_string());

    let notification_email = std::env::var("CLINIC_NOTIFICATION_EMAIL").ok();

    // Where reminder/confirmation messages point patients to manage their own
    // booking (audit finding #2: those messages used to just say "contact
    // us", routing patients around the self-service reschedule/cancel flow
    // that already exists in the app).
    let patient_app_url = std::env::var("PATIENT_APP_URL")
        .unwrap_or_else(|_| "http://localhost:5176".to_string());

    let state = AppState {
        pool: pool.clone(),
        email_service: Arc::new(email_service),
        sms_service: Arc::new(sms_service),
        jwt_secret,
        min_gap_minutes: Arc::new(RwLock::new(min_gap_minutes)),
        min_advance_days: Arc::new(RwLock::new(min_advance_days)),
        max_upcoming_appointments: Arc::new(RwLock::new(max_upcoming_appointments)),
        clinic_name: Arc::new(RwLock::new(clinic_name)),
        clinic_address: Arc::new(RwLock::new(clinic_address)),
        settings,
        otp_limiter: Arc::new(Mutex::new(RateLimiter::new(5, 300))),
        mutation_limiter: Arc::new(Mutex::new(RateLimiter::new(20, 60))),
        notification_email,
        patient_app_url,
    };

    // Background task: send appointment reminders ~24h ahead of the slot,
    // checked every 15 minutes so every appointment's 1-hour reminder
    // window (see reminders.rs) gets swept at least a few times before it
    // passes. `reminder_sent` makes repeat sweeps a no-op for anything
    // already handled.
    let reminder_state = state.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(900)).await;
            match send_appointment_reminders(&reminder_state).await {
                Ok(count) => {
                    if count > 0 {
                        tracing::info!("Sent {} appointment reminders", count);
                    }
                }
                Err(e) => tracing::error!("Failed to send appointment reminders: {:?}", e),
            }
        }
    });

    let cors = {
        let origins: Vec<axum::http::HeaderValue> = std::env::var("CORS_ORIGIN")
            .unwrap_or_else(|_| "http://localhost:5173,http://localhost:5174".to_string())
            .split(',')
            .filter_map(|s| s.trim().parse().ok())
            .collect();

        if origins.is_empty() {
            tracing::warn!("CORS_ORIGIN env var produced no valid origins, falling back to localhost");
            CorsLayer::new()
                .allow_origin("http://localhost:5173".parse::<axum::http::HeaderValue>().unwrap())
        } else {
            CorsLayer::new()
                .allow_origin(origins)
        }
    }
        .allow_credentials(true)
        .allow_methods([axum::http::Method::GET, axum::http::Method::POST, axum::http::Method::PUT, axum::http::Method::PATCH, axum::http::Method::DELETE, axum::http::Method::OPTIONS])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::header::ACCEPT,
        ]);

    let app = Router::new()
        .route("/health", get(health))
        .merge(routes::auth::auth_routes())
        .merge(routes::patients::patient_routes())
        .merge(routes::doctors::doctor_routes())
        .merge(routes::appointments::appointment_routes())
        .merge(routes::settings::settings_routes())
        .merge(routes::unavailability::unavailability_routes())
        .merge(routes::users::users_routes())
        .merge(routes::analytics::analytics_routes())
        .merge(routes::referrals::referral_routes())
        .layer(DefaultBodyLimit::max(2 * 1024 * 1024))
        .layer(CompressionLayer::new())
        .layer(cors)
        .layer(
            TraceLayer::new_for_http()
                .on_response(|response: &axum::http::Response<axum::body::Body>, latency: Duration, _span: &tracing::Span| {
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

    let host = std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let addr = format!("{}:{}", host, port);

    tracing::info!("Server starting on http://{}", addr);

    let listener = match tokio::net::TcpListener::bind(&addr).await {
        Ok(l) => l,
        Err(e) => {
            tracing::error!("Failed to bind to {}: {:?}", addr, e);
            std::process::exit(1);
        }
    };

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .unwrap_or_else(|e| {
            tracing::error!("Server error: {:?}", e);
        });
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::info!("Shutdown signal received, starting graceful shutdown");
}
