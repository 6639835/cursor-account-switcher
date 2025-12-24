use crate::types::{Account, TokenInfo, TokenResponse};
use anyhow::{anyhow, Context, Result};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::Rng;
use reqwest::blocking::Client;
use reqwest::header::{
    HeaderMap, HeaderName, HeaderValue, AUTHORIZATION, CONTENT_TYPE, COOKIE, ORIGIN, REFERER,
    USER_AGENT,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::thread;
use std::time::Duration;
use uuid::Uuid;

const CURSOR_AUTH_CALLBACK_URL: &str = "https://cursor.com/api/auth/loginDeepCallbackControl";
const CURSOR_AUTH_POLL_URL: &str = "https://api2.cursor.sh/auth/poll";
const CURSOR_GET_EMAIL_URL: &str = "https://api2.cursor.sh/aiserver.v1.AuthService/GetEmail";

const POLL_MAX_ATTEMPTS: u32 = 60;
const POLL_INTERVAL_SECS: u64 = 2;

#[derive(Debug, Deserialize)]
struct JwtClaims {
    sub: String,
}

#[derive(Debug, Serialize)]
struct AuthCallbackRequest {
    uuid: String,
    challenge: String,
}

#[derive(Debug, Deserialize)]
struct PollResponse {
    #[serde(rename = "accessToken")]
    access_token: Option<String>,
    #[serde(rename = "refreshToken")]
    refresh_token: Option<String>,
    #[serde(rename = "workSessionToken")]
    work_session_token: Option<String>,
}

#[derive(Debug, Deserialize)]
struct EmailResponse {
    email: Option<String>,
}

/// Extract user ID from JWT token
pub fn extract_user_id_from_jwt(token: &str) -> Result<String> {
    // JWT format: header.payload.signature
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return Err(anyhow!("Invalid JWT format: expected 3 parts"));
    }

    // Decode the payload (second part)
    let payload = parts[1];

    // Base64 URL decode (handle padding)
    let decoded = URL_SAFE_NO_PAD
        .decode(payload)
        .or_else(|_| {
            // Try with padding if needed
            let mut padded = payload.to_string();
            while !padded.len().is_multiple_of(4) {
                padded.push('=');
            }
            base64::engine::general_purpose::URL_SAFE.decode(padded.as_bytes())
        })
        .context("Failed to decode JWT payload")?;

    // Parse JSON to extract 'sub' claim
    let claims: JwtClaims =
        serde_json::from_slice(&decoded).context("Failed to parse JWT claims")?;

    // Extract user ID from 'sub' field (format: "auth0|user_XXXXX" or "user_XXXXX")
    let user_id = if claims.sub.contains('|') {
        claims
            .sub
            .split('|')
            .nth(1)
            .unwrap_or(&claims.sub)
            .to_string()
    } else {
        claims.sub.clone()
    };

    Ok(user_id)
}

/// Generate PKCE code verifier and challenge
pub fn generate_pkce() -> Result<(String, String)> {
    // Generate random verifier (43-128 characters)
    let mut rng = rand::thread_rng();
    let verifier_bytes: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
    let verifier = URL_SAFE_NO_PAD.encode(verifier_bytes);

    // Generate challenge: SHA256(verifier) encoded in base64url
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let challenge_bytes = hasher.finalize();
    let challenge = URL_SAFE_NO_PAD.encode(challenge_bytes);

    Ok((verifier, challenge))
}

/// Check if token is a session token (contains "::" or URL-encoded version)
pub fn is_session_token(token: &str) -> bool {
    token.contains("::") || token.contains("%3A%3A")
}

/// Convert JWT to session token format, or return as-is if already session token
pub fn convert_to_session_token(token: &str) -> Result<String> {
    if is_session_token(token) {
        // Already a session token, decode URL-encoded :: if present
        let decoded = token.replace("%3A%3A", "::").replace("%3a%3a", "::");
        Ok(decoded)
    } else {
        // It's a JWT, extract user ID and build session token
        let user_id = extract_user_id_from_jwt(token)?;
        Ok(format!("{}::{}", user_id, token))
    }
}

/// Validate token and return info
pub fn validate_token_info(token: &str) -> Result<TokenInfo> {
    let token = token.trim();

    // Decode URL-encoded separators first
    let decoded_token = token.replace("%3A%3A", "::").replace("%3a%3a", "::");

    if is_session_token(token) {
        // Session token format: user_xxx::eyJ...
        let parts: Vec<&str> = decoded_token.split("::").collect();
        if parts.len() == 2 {
            let user_id = parts[0].to_string();
            Ok(TokenInfo {
                token_type: "session".to_string(),
                user_id: Some(user_id),
                is_valid: true,
            })
        } else {
            Ok(TokenInfo {
                token_type: "unknown".to_string(),
                user_id: None,
                is_valid: false,
            })
        }
    } else {
        // Try to parse as JWT
        match extract_user_id_from_jwt(token) {
            Ok(user_id) => Ok(TokenInfo {
                token_type: "jwt".to_string(),
                user_id: Some(user_id),
                is_valid: true,
            }),
            Err(_) => Ok(TokenInfo {
                token_type: "unknown".to_string(),
                user_id: None,
                is_valid: false,
            }),
        }
    }
}

/// Token authentication client for Cursor API
pub struct TokenAuthClient {
    client: Client,
}

impl TokenAuthClient {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self { client }
    }

    /// Authorize login with session token
    fn authorize(&self, session_token: &str, code_challenge: &str) -> Result<String> {
        let uuid = Uuid::new_v4().to_string();

        let request_body = AuthCallbackRequest {
            uuid: uuid.clone(),
            challenge: code_challenge.to_string(),
        };

        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        headers.insert(
            USER_AGENT,
            HeaderValue::from_static("Mozilla/5.0 Cursor/1.0"),
        );
        headers.insert(ORIGIN, HeaderValue::from_static("https://cursor.com"));
        headers.insert(
            REFERER,
            HeaderValue::from_static("https://cursor.com/cn/loginDeepControl"),
        );

        // Set session token as cookie
        let cookie_value = format!("WorkosCursorSessionToken={}", session_token);
        headers.insert(
            COOKIE,
            HeaderValue::from_str(&cookie_value).context("Failed to create cookie header")?,
        );

        tracing::info!("Sending authorization request with UUID: {}", uuid);
        tracing::debug!("Session token: {}", session_token);
        tracing::debug!("Challenge: {}", code_challenge);

        let response = self
            .client
            .post(CURSOR_AUTH_CALLBACK_URL)
            .headers(headers)
            .json(&request_body)
            .send()
            .context("Failed to send authorization request")?;

        let status = response.status();
        let body = response.text().unwrap_or_default();

        tracing::info!("Authorization response status: {}", status);
        tracing::debug!("Authorization response body: {}", body);

        if !status.is_success() {
            return Err(anyhow!(
                "Authorization failed with status: {}, body: {}",
                status,
                body
            ));
        }

        Ok(uuid)
    }

    /// Poll for tokens with retry logic
    fn poll_for_tokens(&self, uuid: &str, verifier: &str) -> Result<TokenResponse> {
        let poll_url = format!(
            "{}?uuid={}&verifier={}",
            CURSOR_AUTH_POLL_URL, uuid, verifier
        );

        for attempt in 1..=POLL_MAX_ATTEMPTS {
            let response = self
                .client
                .get(&poll_url)
                .header(USER_AGENT, "Mozilla/5.0 Cursor/1.0")
                .send()
                .context("Failed to poll for tokens")?;

            if response.status().is_success() {
                let poll_response: PollResponse =
                    response.json().context("Failed to parse poll response")?;

                // Check if we got the tokens
                if let Some(access_token) = poll_response.access_token {
                    return Ok(TokenResponse {
                        access_token,
                        refresh_token: poll_response.refresh_token.unwrap_or_default(),
                        work_session_token: poll_response.work_session_token,
                    });
                }
            }

            // Wait before next attempt
            if attempt < POLL_MAX_ATTEMPTS {
                thread::sleep(Duration::from_secs(POLL_INTERVAL_SECS));
            }
        }

        Err(anyhow!(
            "Polling timed out after {} attempts",
            POLL_MAX_ATTEMPTS
        ))
    }

    /// Get email from access token
    fn get_email(&self, access_token: &str) -> Result<String> {
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", access_token))
                .context("Failed to create authorization header")?,
        );
        headers.insert(
            HeaderName::from_static("connect-protocol-version"),
            HeaderValue::from_static("1"),
        );

        let response = self
            .client
            .post(CURSOR_GET_EMAIL_URL)
            .headers(headers)
            .json(&json!({}))
            .send()
            .context("Failed to get email")?;

        if !response.status().is_success() {
            return Err(anyhow!(
                "Failed to get email, status: {}",
                response.status()
            ));
        }

        let email_response: EmailResponse =
            response.json().context("Failed to parse email response")?;

        email_response
            .email
            .ok_or_else(|| anyhow!("Email not found in response"))
    }

    /// Convert token to account (full flow)
    pub fn convert_token_to_account(&self, input_token: &str) -> Result<Account> {
        let input_token = input_token.trim();

        // Step 1: Convert to session token if needed
        let session_token =
            convert_to_session_token(input_token).context("Failed to convert to session token")?;

        // Step 2: Generate PKCE
        let (verifier, challenge) = generate_pkce().context("Failed to generate PKCE")?;

        // Step 3: Authorize
        let uuid = self
            .authorize(&session_token, &challenge)
            .context("Failed to authorize with Cursor API")?;

        // Step 4: Poll for tokens
        let token_response = self
            .poll_for_tokens(&uuid, &verifier)
            .context("Failed to poll for tokens")?;

        // Step 5: Get email
        let email = self
            .get_email(&token_response.access_token)
            .context("Failed to get email from token")?;

        // Step 6: Build account
        let account = Account {
            index: 0, // Will be assigned by CSV manager
            email,
            access_token: token_response.access_token.clone(),
            refresh_token: token_response.refresh_token.clone(),
            cookie: session_token,
            days_remaining: "0".to_string(),
            status: "unknown".to_string(),
            record_time: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            source: "token_import".to_string(),
            usage_used: None,
            usage_remaining: None,
            usage_total: None,
            usage_percentage: None,
        };

        Ok(account)
    }
}
