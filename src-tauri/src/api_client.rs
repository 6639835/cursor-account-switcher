use crate::types::{AccountInfo, UsageInfo};
use anyhow::{Context, Result};
use reqwest::blocking::Client;
use serde::Deserialize;
use std::time::Duration;

pub struct CursorApiClient {
    client: Client,
}

#[derive(Debug, Deserialize)]
struct StripeProfileResponse {
    #[serde(rename = "membershipType")]
    membership_type: Option<String>,
    #[serde(rename = "daysRemainingOnTrial")]
    days_remaining_on_trial: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct UsageResponse {
    #[serde(rename = "planUsage")]
    plan_usage: Option<PlanUsage>,
}

#[derive(Debug, Deserialize)]
struct PlanUsage {
    #[serde(rename = "totalSpend")]
    total_spend: Option<i64>, // in cents
    remaining: Option<i64>, // in cents
    limit: Option<i64>,     // in cents
}

impl CursorApiClient {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self { client }
    }

    pub fn get_account_info(&self, email: &str, access_token: &str) -> Result<AccountInfo> {
        // Get account info from Stripe API
        let stripe_url = "https://api2.cursor.sh/auth/full_stripe_profile";
        let stripe_response: StripeProfileResponse = self
            .client
            .get(stripe_url)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("origin", "vscode-file://vscode-app")
            .header("x-new-onboarding-completed", "false")
            .header("x-ghost-mode", "true")
            .send()
            .context("Failed to get stripe profile")?
            .json()
            .context("Failed to parse stripe response")?;

        let membership_type = stripe_response
            .membership_type
            .unwrap_or_else(|| "free".to_string());
        let days_remaining = stripe_response.days_remaining_on_trial.unwrap_or(0.0);

        Ok(AccountInfo {
            email: email.to_string(),
            membership_type,
            days_remaining,
            is_student: false, // Can be enhanced later
        })
    }

    pub fn get_usage_info(&self, access_token: &str) -> Result<UsageInfo> {
        let url = "https://api2.cursor.sh/aiserver.v1.DashboardService/GetCurrentPeriodUsage";

        let response: UsageResponse = self
            .client
            .post(url)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("Content-Type", "application/json")
            .header("origin", "vscode-file://vscode-app")
            .json(&serde_json::json!({}))
            .send()
            .context("Failed to get usage info")?
            .json()
            .context("Failed to parse usage response")?;

        let plan_usage = response
            .plan_usage
            .ok_or_else(|| anyhow::anyhow!("Response missing planUsage field"))?;

        // Values are in cents, convert to dollars
        let total_spend_cents = plan_usage.total_spend.unwrap_or(0) as f64;
        let remaining_cents = plan_usage.remaining.unwrap_or(0) as f64;
        let limit_cents = plan_usage.limit.unwrap_or(0) as f64;

        let used = total_spend_cents / 100.0;
        let remaining = remaining_cents / 100.0;
        let total_quota = limit_cents / 100.0;

        let usage_percentage = if limit_cents > 0.0 {
            (total_spend_cents / limit_cents * 100.0).min(100.0)
        } else {
            0.0
        };

        Ok(UsageInfo {
            total_quota,
            used,
            remaining,
            usage_percentage,
        })
    }
}
