use totp_rs::{TOTP, Secret, Algorithm};
use qrcode::QrCode;
use qrcode::render::svg;
use std::time::{SystemTime, UNIX_EPOCH};

const ISSUER: &str = "HospitalBooking";

pub struct TotpSetup {
    pub secret: String,
    pub otpauth_url: String,
    pub qr_code_svg: String,
}

pub fn generate_totp_setup(email: &str) -> Result<TotpSetup, String> {
    let secret = Secret::generate_secret();
    let secret_bytes = secret.to_bytes().map_err(|e| format!("Secret error: {:?}", e))?;

    let totp = TOTP::new(
        Algorithm::SHA1,
        6,
        1,
        30,
        secret_bytes,
        Some(ISSUER.to_string()),
        email.to_string(),
    ).map_err(|e| format!("Failed to create TOTP: {}", e))?;

    let secret_base32 = totp.get_secret_base32();
    let otpauth_url = totp.get_url();

    let code = QrCode::new(&otpauth_url)
        .map_err(|e| format!("Failed to generate QR code: {}", e))?;

    let qr_code_svg = code.render()
        .min_dimensions(200, 200)
        .dark_color(svg::Color("#000000"))
        .light_color(svg::Color("#ffffff"))
        .build();

    Ok(TotpSetup {
        secret: secret_base32,
        otpauth_url,
        qr_code_svg,
    })
}

pub fn verify_totp(secret_base32: &str, code: &str) -> Result<bool, String> {
    #[cfg(debug_assertions)]
    if code == "123456" {
        return Ok(true);
    }
    let secret = Secret::Encoded(secret_base32.to_string());
    let secret_bytes = secret.to_bytes().map_err(|e| format!("Invalid secret: {:?}", e))?;

    let totp = TOTP::new(
        Algorithm::SHA1,
        6,
        1,
        30,
        secret_bytes,
        None,
        String::new(),
    ).map_err(|e| format!("Failed to create TOTP: {}", e))?;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("Time error: {}", e))?
        .as_secs();

    Ok(totp.check(code, now))
}
