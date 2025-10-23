use crate::types::Account;
use anyhow::Result;
use csv::{Reader, Writer};
use std::fs::OpenOptions;
use std::path::PathBuf;

pub struct CsvManager {
    file_path: PathBuf,
}

impl CsvManager {
    pub fn new(file_path: PathBuf) -> Self {
        Self { file_path }
    }

    pub fn ensure_csv_exists(&self) -> Result<()> {
        if !self.file_path.exists() {
            self.create_default_csv()?;
        }
        Ok(())
    }

    fn create_default_csv(&self) -> Result<()> {
        let file = OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(&self.file_path)?;

        let mut writer = Writer::from_writer(file);
        writer.write_record([
            "Index",
            "Email",
            "Access Token",
            "Refresh Token",
            "Cookie",
            "Days Remaining",
            "Status",
            "Record Time",
        ])?;
        writer.flush()?;

        Ok(())
    }

    pub fn read_accounts(&self) -> Result<Vec<Account>> {
        let mut reader = Reader::from_path(&self.file_path)?;
        let mut accounts = Vec::new();

        for result in reader.records() {
            let record = result?;
            if record.len() >= 8 {
                accounts.push(Account {
                    index: record.get(0).unwrap_or("0").parse().unwrap_or(0),
                    email: record.get(1).unwrap_or("").to_string(),
                    access_token: record.get(2).unwrap_or("").to_string(),
                    refresh_token: record.get(3).unwrap_or("").to_string(),
                    cookie: record.get(4).unwrap_or("").to_string(),
                    days_remaining: record.get(5).unwrap_or("0").to_string(),
                    status: record.get(6).unwrap_or("unknown").to_string(),
                    record_time: record.get(7).unwrap_or("").to_string(),
                });
            }
        }

        Ok(accounts)
    }

    pub fn write_accounts(&self, accounts: &[Account]) -> Result<()> {
        let file = OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(&self.file_path)?;

        let mut writer = Writer::from_writer(file);

        // Write header
        writer.write_record([
            "Index",
            "Email",
            "Access Token",
            "Refresh Token",
            "Cookie",
            "Days Remaining",
            "Status",
            "Record Time",
        ])?;

        // Write accounts
        for account in accounts {
            writer.write_record([
                &account.index.to_string(),
                &account.email,
                &account.access_token,
                &account.refresh_token,
                &account.cookie,
                &account.days_remaining,
                &account.status,
                &account.record_time,
            ])?;
        }

        writer.flush()?;
        Ok(())
    }

    pub fn add_account(&self, account: Account) -> Result<()> {
        let mut accounts = self.read_accounts()?;

        // Auto-increment index
        let max_index = accounts.iter().map(|a| a.index).max().unwrap_or(0);
        let mut new_account = account;
        new_account.index = max_index + 1;

        accounts.push(new_account);
        self.write_accounts(&accounts)?;
        Ok(())
    }

    pub fn delete_account(&self, email: &str) -> Result<bool> {
        let mut accounts = self.read_accounts()?;
        let original_len = accounts.len();

        accounts.retain(|a| a.email != email);

        if accounts.len() < original_len {
            self.write_accounts(&accounts)?;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    pub fn update_account(&self, email: &str, updated_account: Account) -> Result<bool> {
        let mut accounts = self.read_accounts()?;
        let mut found = false;

        for account in &mut accounts {
            if account.email == email {
                *account = updated_account.clone();
                found = true;
                break;
            }
        }

        if found {
            self.write_accounts(&accounts)?;
        }

        Ok(found)
    }

    pub fn parse_import_text(&self, text: &str) -> Result<Vec<Account>> {
        let mut accounts = Vec::new();

        for line in text.lines() {
            if line.trim().is_empty() {
                continue;
            }

            let account = self.parse_account_line(line)?;
            accounts.push(account);
        }

        Ok(accounts)
    }

    fn parse_account_line(&self, line: &str) -> Result<Account> {
        use chrono::Local;

        // Parse format: 【email: xxx】【password:】【accessToken: xxx】【sessionToken: xxx】
        let email = self.extract_field(line, "email")?;
        let access_token = self.extract_field(line, "accessToken")?;
        let session_token = self.extract_field(line, "sessionToken").unwrap_or_default();

        Ok(Account {
            index: 0, // Will be auto-assigned
            email,
            access_token: access_token.clone(),
            refresh_token: access_token, // Same as access token usually
            cookie: session_token,
            days_remaining: "0".to_string(),
            status: "unknown".to_string(),
            record_time: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        })
    }

    fn extract_field(&self, text: &str, field_name: &str) -> Result<String> {
        let pattern = format!("【{}:", field_name);
        if let Some(start_idx) = text.find(&pattern) {
            let start = start_idx + pattern.len();
            if let Some(end_idx) = text[start..].find('】') {
                let value = text[start..start + end_idx].trim();
                return Ok(value.to_string());
            }
        }
        anyhow::bail!("Field '{}' not found", field_name)
    }
}
