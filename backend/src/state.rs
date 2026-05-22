use std::sync::Arc;
use sqlx::PgPool;
use crate::services::{EmailService, SettingsService, SmsService};

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub email_service: Arc<EmailService>,
    pub sms_service: Arc<SmsService>,
    pub jwt_secret: String,
    pub min_gap_minutes: i64,
    pub settings: SettingsService,
}
