use lettre::{
    transport::smtp::authentication::Credentials,
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
};
use lettre::message::header::ContentType;
use tracing::info;

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
        let transport = match (host, user, pass) {
            (Some(host), Some(user), Some(pass)) => {
                let creds = Credentials::new(user, pass);
                Some(
                    AsyncSmtpTransport::<Tokio1Executor>::relay(&host)
                        .unwrap()
                        .credentials(creds)
                        .build(),
                )
            }
            _ => {
                info!("SMTP not configured, email sending disabled");
                None
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
}
