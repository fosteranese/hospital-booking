use std::sync::{Arc, RwLock};
use sqlx::PgPool;
use crate::services::{EmailService, SettingsService, SmsService};

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
}
