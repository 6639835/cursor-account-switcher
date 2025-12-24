use crate::types::{BillingCycle, DetailedUserInfo};
use anyhow::{Context, Result};
use reqwest::blocking::Client;
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, COOKIE, ORIGIN, REFERER, USER_AGENT};
use serde_json::Value;
use std::time::Duration;

const USAGE_EVENTS_URL: &str = "https://cursor.com/api/dashboard/get-filtered-usage-events";
const GET_ME_URL: &str = "https://cursor.com/api/dashboard/get-me";
const LIST_INVOICES_URL: &str = "https://cursor.com/api/dashboard/list-invoices";
const CURRENT_BILLING_CYCLE_URL: &str =
    "https://cursor.com/api/dashboard/get-current-billing-cycle";

pub struct DetailedUsageClient {
    client: Client,
}

impl DetailedUsageClient {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self { client }
    }

    fn create_headers(&self, session_token: &str, referer: &str) -> Result<HeaderMap> {
        let mut headers = HeaderMap::new();
        headers.insert(
            USER_AGENT,
            HeaderValue::from_static(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            ),
        );
        headers.insert(ACCEPT, HeaderValue::from_static("*/*"));
        headers.insert(ORIGIN, HeaderValue::from_static("https://cursor.com"));
        headers.insert(REFERER, HeaderValue::from_str(referer)?);

        let cookie_value = format!("WorkosCursorSessionToken={}", session_token);
        headers.insert(COOKIE, HeaderValue::from_str(&cookie_value)?);

        Ok(headers)
    }

    /// Get filtered usage events
    pub fn get_usage_events(&self, session_token: &str) -> Result<Value> {
        let headers =
            self.create_headers(session_token, "https://cursor.com/cn/dashboard?tab=usage")?;

        let body = serde_json::json!({});

        tracing::info!("Fetching usage events");

        let response = self
            .client
            .post(USAGE_EVENTS_URL)
            .headers(headers)
            .json(&body)
            .send()
            .context("Failed to fetch usage events")?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!(
                "Failed to get usage events: {}",
                response.status()
            ));
        }

        let data: Value = response.json().context("Failed to parse usage events")?;
        Ok(data)
    }

    /// Get detailed user info (get-me endpoint)
    pub fn get_detailed_user_info(&self, session_token: &str) -> Result<DetailedUserInfo> {
        let headers =
            self.create_headers(session_token, "https://cursor.com/cn/dashboard?tab=billing")?;

        let body = serde_json::json!({});

        tracing::info!("Fetching detailed user info");

        let response = self
            .client
            .post(GET_ME_URL)
            .headers(headers)
            .json(&body)
            .send()
            .context("Failed to fetch user info")?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!(
                "Failed to get user info: {}",
                response.status()
            ));
        }

        let data: Value = response.json().context("Failed to parse user info")?;

        // Extract fields from the response
        let user_info = DetailedUserInfo {
            email: data.get("email").and_then(|v| v.as_str()).map(String::from),
            user_id: data
                .get("userId")
                .and_then(|v| v.as_str())
                .map(String::from),
            membership_type: data
                .get("membershipType")
                .and_then(|v| v.as_str())
                .map(String::from),
            subscription_status: data
                .get("subscriptionStatus")
                .and_then(|v| v.as_str())
                .map(String::from),
        };

        Ok(user_info)
    }

    /// List invoices
    pub fn list_invoices(&self, session_token: &str) -> Result<Value> {
        let headers =
            self.create_headers(session_token, "https://cursor.com/cn/dashboard?tab=billing")?;

        let body = serde_json::json!({
            "teamId": 0,
            "page": 1,
            "pageSize": 100
        });

        tracing::info!("Fetching invoices");

        let response = self
            .client
            .post(LIST_INVOICES_URL)
            .headers(headers)
            .json(&body)
            .send()
            .context("Failed to fetch invoices")?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!(
                "Failed to list invoices: {}",
                response.status()
            ));
        }

        let data: Value = response.json().context("Failed to parse invoices")?;
        Ok(data)
    }

    /// Get current billing cycle
    pub fn get_billing_cycle(&self, session_token: &str) -> Result<BillingCycle> {
        let headers =
            self.create_headers(session_token, "https://cursor.com/cn/dashboard?tab=usage")?;

        let body = serde_json::json!({});

        tracing::info!("Fetching billing cycle");

        let response = self
            .client
            .post(CURRENT_BILLING_CYCLE_URL)
            .headers(headers)
            .json(&body)
            .send()
            .context("Failed to fetch billing cycle")?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!(
                "Failed to get billing cycle: {}",
                response.status()
            ));
        }

        let data: Value = response.json().context("Failed to parse billing cycle")?;

        let billing_cycle = BillingCycle {
            start_date: data
                .get("startDate")
                .and_then(|v| v.as_str())
                .map(String::from),
            end_date: data
                .get("endDate")
                .and_then(|v| v.as_str())
                .map(String::from),
            usage: data.get("usage").and_then(|v| v.as_f64()),
            limit: data.get("limit").and_then(|v| v.as_f64()),
        };

        Ok(billing_cycle)
    }
}
