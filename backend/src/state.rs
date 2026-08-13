use std::sync::{Arc, RwLock, PoisonError, Mutex};
use sqlx::PgPool;
use crate::error::AppError;
use crate::services::{EmailService, SettingsService, SmsService};
use crate::ratelimit::RateLimiter;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub email_service: Arc<EmailService>,
    pub sms_service: Arc<SmsService>,
    pub jwt_secret: String,
    pub min_gap_minutes: Arc<RwLock<i64>>,
    pub min_advance_days: Arc<RwLock<i64>>,
    pub max_upcoming_appointments: Arc<RwLock<i64>>,
    pub clinic_name: Arc<RwLock<String>>,
    pub clinic_address: Arc<RwLock<String>>,
    pub settings: SettingsService,
    pub otp_limiter: Arc<Mutex<RateLimiter>>,
    pub mutation_limiter: Arc<Mutex<RateLimiter>>,
    pub notification_email: Option<String>,
    pub patient_app_url: String,
}

impl AppState {
    pub fn min_gap_minutes(&self) -> i64 {
        *self.min_gap_minutes.read().unwrap_or_else(PoisonError::into_inner)
    }

    pub fn set_min_gap_minutes(&self, val: i64) {
        *self.min_gap_minutes.write().unwrap_or_else(PoisonError::into_inner) = val;
    }

    pub fn min_advance_days(&self) -> i64 {
        *self.min_advance_days.read().unwrap_or_else(PoisonError::into_inner)
    }

    pub fn set_min_advance_days(&self, val: i64) {
        *self.min_advance_days.write().unwrap_or_else(PoisonError::into_inner) = val;
    }

    pub fn max_upcoming_appointments(&self) -> i64 {
        *self.max_upcoming_appointments.read().unwrap_or_else(PoisonError::into_inner)
    }

    pub fn set_max_upcoming_appointments(&self, val: i64) {
        *self.max_upcoming_appointments.write().unwrap_or_else(PoisonError::into_inner) = val;
    }

    pub fn clinic_name(&self) -> String {
        self.clinic_name.read().unwrap_or_else(PoisonError::into_inner).clone()
    }

    pub fn set_clinic_name(&self, val: String) {
        *self.clinic_name.write().unwrap_or_else(PoisonError::into_inner) = val;
    }

    pub fn clinic_address(&self) -> String {
        self.clinic_address.read().unwrap_or_else(PoisonError::into_inner).clone()
    }

    pub fn set_clinic_address(&self, val: String) {
        *self.clinic_address.write().unwrap_or_else(PoisonError::into_inner) = val;
    }

    pub fn check_mutation_rate_limit(&self, key: &str) -> Result<(), AppError> {
        let limiter = self.mutation_limiter.lock().unwrap_or_else(PoisonError::into_inner);
        if !limiter.check(key) {
            return Err(AppError::TooManyRequests("Too many requests. Please try again later.".to_string()));
        }
        Ok(())
    }
}
