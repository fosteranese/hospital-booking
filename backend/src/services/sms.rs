use tracing::info;

pub struct SmsService;

impl SmsService {
    pub fn new() -> Self {
        Self
    }

    pub async fn send_otp(&self, to_phone: &str, _code: &str) -> Result<(), String> {
        // Mock implementation - logs to console
        // Replace with actual SMS provider (Twilio, etc.)
        info!("[SMS MOCK] OTP sent to {}", to_phone);
        Ok(())
    }
}
