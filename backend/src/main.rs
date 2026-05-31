use std::sync::{Arc, RwLock};
use axum::Router;
use axum::extract::DefaultBodyLimit;
use axum::routing::get;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::EnvFilter;
use std::time::Duration;

mod db;
mod error;
mod middleware;
mod models;
mod routes;
mod services;
mod state;

use crate::state::AppState;
use crate::services::{EmailService, SettingsService, SmsService, generate_slots};

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

    if let Err(e) = generate_slots(&pool, &settings).await {
        tracing::error!("Failed to generate slots: {:?}", e);
        std::process::exit(1);
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

    let smtp_host = settings.get("smtp", "host").await.ok().flatten();
    let smtp_user = settings.get("smtp", "user").await.ok().flatten();
    let smtp_pass = settings.get("smtp", "pass").await.ok().flatten();
    let from_email = settings.get("smtp", "from_email").await.ok().flatten()
        .unwrap_or_else(|| "noreply@hospital.com".to_string());

    let email_service = EmailService::new(smtp_host, smtp_user, smtp_pass, from_email);
    let sms_service = SmsService::new();

    let jwt_secret = match std::env::var("JWT_SECRET") {
        Ok(k) => k,
        Err(_) => {
            tracing::error!("JWT_SECRET must be set");
            std::process::exit(1);
        }
    };

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
    };

    let cors = {
        let origins: Vec<axum::http::HeaderValue> = std::env::var("CORS_ORIGIN")
            .unwrap_or_else(|_| "http://localhost:5173".to_string())
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
        .layer(DefaultBodyLimit::max(2 * 1024 * 1024))
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
