use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub index: i32,
    pub email: String,
    pub access_token: String,
    pub refresh_token: String,
    pub cookie: String,
    pub days_remaining: String,
    pub status: String,
    pub record_time: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage_used: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage_remaining: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage_total: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage_percentage: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountInfo {
    pub email: String,
    pub membership_type: String,
    pub days_remaining: f64,
    pub is_student: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageInfo {
    pub total_quota: f64,
    pub used: f64,
    pub remaining: f64,
    pub usage_percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MachineIds {
    pub machine_id: String,
    pub mac_machine_id: String,
    pub dev_device_id: String,
    pub sqm_id: String,
}
