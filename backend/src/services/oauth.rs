// Google Sign-In verification.
//
// Deliberately the "verify an id_token" flow (Google Identity Services /
// GSI), not the classic redirect-based authorization-code exchange. GSI's
// client-side button hands the frontend a signed JWT directly -- there is no
// client_secret anywhere in this flow, nothing for a SPA to leak, and the
// backend's whole job is reduced to: verify the signature against Google's
// own public keys, then check the claims. That's what this module does.
//
// Apple Sign In is intentionally not implemented yet (see oauth_apple_handler
// in routes/auth.rs) -- it requires a paid Apple Developer account and a
// Services ID / Key ID / Team ID / private key that don't exist for this
// deployment yet. The route exists and returns a clear 503 so the frontend
// integration point is real; wiring up real verification is a follow-up once
// those credentials exist.
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Deserializer};
use std::collections::HashMap;
use std::sync::RwLock;
use std::time::{Duration, Instant};

const GOOGLE_JWKS_URL: &str = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS: [&str; 2] = ["https://accounts.google.com", "accounts.google.com"];
// Google rotates signing keys periodically (not on a fixed schedule) and
// documents that clients should cache keys respecting the response's
// Cache-Control max-age rather than refetching per-request. An hour is a
// conservative fixed TTL that stays well inside that window without pinning
// to a header we'd have to parse.
const JWKS_CACHE_TTL: Duration = Duration::from_secs(3600);

#[derive(Debug, Deserialize)]
struct GoogleJwk {
    kid: String,
    n: String,
    e: String,
}

#[derive(Debug, Deserialize)]
struct GoogleJwksResponse {
    keys: Vec<GoogleJwk>,
}

// Google's own client libraries have historically sent this as either a JSON
// bool or a stringified "true"/"false" depending on version -- accept both
// rather than trusting one shape and silently failing verification for real
// tokens that happen to use the other.
fn deserialize_email_verified<'de, D>(deserializer: D) -> Result<bool, D::Error>
where
    D: Deserializer<'de>,
{
    use serde::de::Error;
    match serde_json::Value::deserialize(deserializer)? {
        serde_json::Value::Bool(b) => Ok(b),
        serde_json::Value::String(s) => Ok(s == "true"),
        other => Err(D::Error::custom(format!("unexpected email_verified value: {other}"))),
    }
}

#[derive(Debug, Deserialize)]
pub struct GoogleIdClaims {
    pub email: String,
    #[serde(deserialize_with = "deserialize_email_verified")]
    pub email_verified: bool,
    #[allow(dead_code)]
    pub sub: String,
}

struct CachedKeys {
    keys: HashMap<String, DecodingKey>,
    fetched_at: Instant,
}

pub struct GoogleOAuthService {
    client_id: String,
    http: reqwest::Client,
    cache: RwLock<Option<CachedKeys>>,
}

impl GoogleOAuthService {
    pub fn new(client_id: String) -> Self {
        Self { client_id, http: reqwest::Client::new(), cache: RwLock::new(None) }
    }

    async fn fetch_and_cache_keys(&self) -> Result<HashMap<String, DecodingKey>, String> {
        let resp: GoogleJwksResponse = self
            .http
            .get(GOOGLE_JWKS_URL)
            .send()
            .await
            .map_err(|e| format!("Failed to reach Google's signing-key endpoint: {e}"))?
            .json()
            .await
            .map_err(|e| format!("Failed to parse Google's signing keys: {e}"))?;

        let keys: HashMap<String, DecodingKey> = resp
            .keys
            .into_iter()
            .filter_map(|jwk| {
                DecodingKey::from_rsa_components(&jwk.n, &jwk.e)
                    .ok()
                    .map(|k| (jwk.kid, k))
            })
            .collect();

        *self.cache.write().unwrap_or_else(|e| e.into_inner()) =
            Some(CachedKeys { keys: keys.clone(), fetched_at: Instant::now() });
        Ok(keys)
    }

    async fn key_for(&self, kid: &str) -> Result<DecodingKey, String> {
        {
            let cache = self.cache.read().unwrap_or_else(|e| e.into_inner());
            if let Some(c) = cache.as_ref() {
                if c.fetched_at.elapsed() < JWKS_CACHE_TTL {
                    if let Some(k) = c.keys.get(kid) {
                        return Ok(k.clone());
                    }
                }
            }
        }
        // Cache miss -- either the first call, the cache expired, or Google
        // rotated keys since we last fetched. Refetch and try once more;
        // a kid that still isn't present after a fresh fetch means the
        // token really doesn't match any current Google signing key.
        let keys = self.fetch_and_cache_keys().await?;
        keys.get(kid)
            .cloned()
            .ok_or_else(|| "Token signing key not recognized".to_string())
    }

    /// Verifies signature, issuer, audience, and expiry (all via
    /// jsonwebtoken's own validation, not hand-rolled), then checks the
    /// Google-specific email_verified claim. Only ever returns claims Google
    /// itself cryptographically vouches for -- never trusts a client-supplied
    /// email without this whole chain succeeding first.
    pub async fn verify(&self, id_token: &str) -> Result<GoogleIdClaims, String> {
        let header = decode_header(id_token).map_err(|e| format!("Malformed token: {e}"))?;
        let kid = header.kid.ok_or("Token is missing a key id")?;
        let key = self.key_for(&kid).await?;

        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_audience(&[self.client_id.as_str()]);
        validation.set_issuer(&GOOGLE_ISSUERS);

        let data = decode::<GoogleIdClaims>(id_token, &key, &validation)
            .map_err(|e| format!("Token verification failed: {e}"))?;

        if !data.claims.email_verified {
            return Err("Google account email is not verified".to_string());
        }
        Ok(data.claims)
    }
}
