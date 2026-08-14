// Social sign-in: Google and Apple.
//
// Both are the "verify a client-side id_token" flow, not the classic
// redirect-based authorization-code exchange. Each provider's JS SDK hands
// the frontend a signed JWT directly -- there is no client_secret anywhere
// in this flow, nothing for a SPA to leak, and the backend's whole job is
// reduced to: verify the signature against the provider's own public keys,
// then check the claims. Google and Apple both publish a standard JWK Set
// for exactly this, so the fetch-and-cache mechanics are shared (JwksKeyStore
// below); only the per-provider issuer/audience/claims rules differ.
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Deserializer};
use std::collections::HashMap;
use std::sync::RwLock;
use std::time::{Duration, Instant};

// Both providers rotate signing keys periodically (no fixed schedule) and
// document that clients should cache keys rather than refetching per
// request. An hour is a conservative fixed TTL that stays well inside that
// window without pinning to a header we'd have to parse.
const JWKS_CACHE_TTL: Duration = Duration::from_secs(3600);

#[derive(Debug, Deserialize)]
struct Jwk {
    kid: String,
    n: String,
    e: String,
}

#[derive(Debug, Deserialize)]
struct JwksResponse {
    keys: Vec<Jwk>,
}

struct CachedKeys {
    keys: HashMap<String, DecodingKey>,
    fetched_at: Instant,
}

/// Fetches a JWKS endpoint, caches its keys by `kid`, refetches on a cache
/// miss or once JWKS_CACHE_TTL has elapsed. Both Google and Apple sign-in
/// use this same shape (RS256, a standard JWK Set response) -- each
/// provider's actual verification rules (issuer, audience, which extra
/// claims to check) live in their own wrapper type below, not here.
struct JwksKeyStore {
    url: &'static str,
    http: reqwest::Client,
    cache: RwLock<Option<CachedKeys>>,
}

impl JwksKeyStore {
    fn new(url: &'static str) -> Self {
        Self { url, http: reqwest::Client::new(), cache: RwLock::new(None) }
    }

    async fn fetch_and_cache(&self) -> Result<HashMap<String, DecodingKey>, String> {
        let resp: JwksResponse = self
            .http
            .get(self.url)
            .send()
            .await
            .map_err(|e| format!("Failed to reach {}: {e}", self.url))?
            .json()
            .await
            .map_err(|e| format!("Failed to parse signing keys from {}: {e}", self.url))?;

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
        // Cache miss -- either the first call, the cache expired, or the
        // provider rotated keys since we last fetched. Refetch and try once
        // more; a kid that still isn't present after a fresh fetch means the
        // token really doesn't match any current signing key.
        let keys = self.fetch_and_cache().await?;
        keys.get(kid)
            .cloned()
            .ok_or_else(|| "Token signing key not recognized".to_string())
    }
}

// Google and Apple have both, at different times, sent boolean-shaped claims
// as either a JSON bool or a stringified "true"/"false" depending on client
// version. Accept both rather than trusting one shape and silently failing
// verification for real tokens that happen to use the other.
fn deserialize_bool_ish<'de, D>(deserializer: D) -> Result<bool, D::Error>
where
    D: Deserializer<'de>,
{
    use serde::de::Error;
    match serde_json::Value::deserialize(deserializer)? {
        serde_json::Value::Bool(b) => Ok(b),
        serde_json::Value::String(s) => Ok(s == "true"),
        other => Err(D::Error::custom(format!("unexpected boolean-ish value: {other}"))),
    }
}

// ─── Google ────────────────────────────────────────────────────────────

const GOOGLE_JWKS_URL: &str = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS: [&str; 2] = ["https://accounts.google.com", "accounts.google.com"];

#[derive(Debug, Deserialize)]
pub struct GoogleIdClaims {
    pub email: String,
    #[serde(deserialize_with = "deserialize_bool_ish")]
    pub email_verified: bool,
    #[allow(dead_code)]
    pub sub: String,
}

pub struct GoogleOAuthService {
    client_id: String,
    keys: JwksKeyStore,
}

impl GoogleOAuthService {
    pub fn new(client_id: String) -> Self {
        Self { client_id, keys: JwksKeyStore::new(GOOGLE_JWKS_URL) }
    }

    /// Verifies signature, issuer, audience, and expiry (all via
    /// jsonwebtoken's own validation, not hand-rolled), then checks the
    /// Google-specific email_verified claim. Only ever returns claims Google
    /// itself cryptographically vouches for -- never trusts a client-supplied
    /// email without this whole chain succeeding first.
    pub async fn verify(&self, id_token: &str) -> Result<GoogleIdClaims, String> {
        let header = decode_header(id_token).map_err(|e| format!("Malformed token: {e}"))?;
        let kid = header.kid.ok_or("Token is missing a key id")?;
        let key = self.keys.key_for(&kid).await?;

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

// ─── Apple ─────────────────────────────────────────────────────────────
//
// "Sign in with Apple JS" (usePopup: true, response including id_token)
// hands back a real, independently-verifiable Apple-signed JWT client-side
// -- verifying it is exactly the same shape as Google's flow, which is why
// this doesn't need the Team ID / Key ID / private key at all. Those are
// only required for the *authorization-code* exchange (server-side token
// refresh, or requesting a fresh id_token later) -- out of scope here, since
// "identify the patient once and hand them a session" never needs to
// refresh anything.
//
// What Apple *does* require that Google doesn't: a real, domain-verified
// HTTPS origin registered as a "Return URL" in the Apple Developer portal
// -- Apple Sign In has no localhost allowance, unlike Google's "Authorized
// JavaScript origins". See AGENTS.md / the setup notes wherever this is
// documented for the deployment-specific domain that needs registering.

const APPLE_JWKS_URL: &str = "https://appleid.apple.com/auth/keys";
const APPLE_ISSUER: &str = "https://appleid.apple.com";

#[derive(Debug, Deserialize)]
pub struct AppleIdClaims {
    // Apple only includes `email` on tokens issued from a genuine sign-in
    // (not on subsequent silent-refresh tokens, which this flow never
    // requests anyway) -- still Option out of caution rather than assuming.
    pub email: Option<String>,
    #[serde(default, deserialize_with = "deserialize_bool_ish")]
    pub email_verified: bool,
    #[allow(dead_code)]
    pub sub: String,
}

pub struct AppleOAuthService {
    // The "Services ID" identifier, which is what Apple calls `client_id` /
    // `aud` in this context -- distinct from the Team ID or Key ID.
    services_id: String,
    keys: JwksKeyStore,
}

impl AppleOAuthService {
    pub fn new(services_id: String) -> Self {
        Self { services_id, keys: JwksKeyStore::new(APPLE_JWKS_URL) }
    }

    pub async fn verify(&self, id_token: &str) -> Result<AppleIdClaims, String> {
        let header = decode_header(id_token).map_err(|e| format!("Malformed token: {e}"))?;
        let kid = header.kid.ok_or("Token is missing a key id")?;
        let key = self.keys.key_for(&kid).await?;

        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_audience(&[self.services_id.as_str()]);
        validation.set_issuer(&[APPLE_ISSUER]);

        let data = decode::<AppleIdClaims>(id_token, &key, &validation)
            .map_err(|e| format!("Token verification failed: {e}"))?;

        if data.claims.email.is_none() {
            return Err("Apple did not include an email on this sign-in".to_string());
        }
        if !data.claims.email_verified {
            return Err("Apple account email is not verified".to_string());
        }
        Ok(data.claims)
    }
}
