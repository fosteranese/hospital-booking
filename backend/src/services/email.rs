use lettre::{
    transport::smtp::authentication::Credentials,
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
};
use lettre::message::header::ContentType;
use tracing::{info, warn};

pub struct EmailService {
    from_email: String,
    transport: Option<AsyncSmtpTransport<Tokio1Executor>>,
}

impl EmailService {
    pub fn new(
        host: Option<String>,
        user: Option<String>,
        pass: Option<String>,
        from_email: String,
    ) -> Self {
        let transport = if cfg!(debug_assertions) {
            info!("Debug build: email transport disabled");
            None
        } else {
            match (host, user, pass) {
                (Some(host), Some(user), Some(pass)) => {
                    let creds = Credentials::new(user, pass);
                    match AsyncSmtpTransport::<Tokio1Executor>::relay(&host) {
                        Ok(relay) => Some(relay.credentials(creds).build()),
                        Err(e) => {
                            warn!("Failed to configure SMTP relay for {}: {:?}. Email sending disabled.", host, e);
                            None
                        }
                    }
                }
                _ => {
                    info!("SMTP not configured, email sending disabled");
                    None
                }
            }
        };

        Self { from_email, transport }
    }

    pub async fn send_otp(&self, to_email: &str, code: &str) -> Result<(), String> {
        let body = format!("Your verification code is: {}\n\nThis code expires in 10 minutes.", code);

        if let Some(transport) = &self.transport {
            match Message::builder()
                .from(self.from_email.parse().map_err(|e| format!("Invalid from email: {}", e))?)
                .to(to_email.parse().map_err(|e| format!("Invalid to email: {}", e))?)
                .subject("Hospital Booking - Verification Code")
                .header(ContentType::TEXT_PLAIN)
                .body(body.clone())
            {
                Ok(email) => {
                    if let Err(e) = transport.send(email).await {
                        info!("[EMAIL FALLBACK] SMTP send failed ({}), logging OTP for {}: {}", e, to_email, code);
                    }
                }
                Err(e) => {
                    info!("[EMAIL FALLBACK] Email build failed ({}), logging OTP for {}: {}", e, to_email, code);
                }
            }
        } else {
            info!("[EMAIL MOCK] OTP for {}: {}", to_email, code);
        }

        Ok(())
    }

    pub async fn send_appointment_confirmation(
        &self,
        to_email: &str,
        patient_name: &str,
        doctor_name: &str,
        date: &str,
        time: &str,
        notes: &str,
        clinic_name: &str,
        clinic_address: &str,
    ) -> Result<(), String> {
        let notes_section = if notes.is_empty() {
            String::new()
        } else {
            format!("\n\nReason for visit: {}", notes)
        };

        let body = format!(
            "Dear {},\n\nYour appointment has been confirmed.\n\nDoctor: {}\nDate: {}\nTime: {}\n\nLocation: {}\n{}{}{}",
            patient_name, doctor_name, date, time, clinic_name, clinic_address, notes_section,
            "\n\nPlease arrive 15 minutes before your scheduled time.\n\nIf you need to reschedule or cancel, please contact us at +233 24 138 2827."
        );

        if let Some(transport) = &self.transport {
            match Message::builder()
                .from(self.from_email.parse().map_err(|e| format!("Invalid from email: {}", e))?)
                .to(to_email.parse().map_err(|e| format!("Invalid to email: {}", e))?)
                .subject(format!("Appointment Confirmed - {}", clinic_name))
                .header(ContentType::TEXT_PLAIN)
                .body(body.clone())
            {
                Ok(email) => {
                    if let Err(e) = transport.send(email).await {
                        info!("[EMAIL FALLBACK] Confirmation send failed ({}), logging for {}: {}", e, to_email, patient_name);
                    }
                }
                Err(e) => {
                    info!("[EMAIL FALLBACK] Confirmation build failed ({}), logging for {}: {}", e, to_email, patient_name);
                }
            }
        } else {
            info!("[EMAIL MOCK] Confirmation for {} <{}>: {}", patient_name, to_email, body);
        }

        Ok(())
    }
}
