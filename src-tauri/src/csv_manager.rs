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
            "Source",
            "Usage Used",
            "Usage Remaining",
            "Usage Total",
            "Usage Percentage",
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
                let source = record.get(8).unwrap_or("imported").to_string();
                let usage_used = record.get(9).and_then(|s| s.parse().ok());
                let usage_remaining = record.get(10).and_then(|s| s.parse().ok());
                let usage_total = record.get(11).and_then(|s| s.parse().ok());
                let usage_percentage = record.get(12).and_then(|s| s.parse().ok());

                accounts.push(Account {
                    index: record.get(0).unwrap_or("0").parse().unwrap_or(0),
                    email: record.get(1).unwrap_or("").to_string(),
                    access_token: record.get(2).unwrap_or("").to_string(),
                    refresh_token: record.get(3).unwrap_or("").to_string(),
                    cookie: record.get(4).unwrap_or("").to_string(),
                    days_remaining: record.get(5).unwrap_or("0").to_string(),
                    status: record.get(6).unwrap_or("unknown").to_string(),
                    record_time: record.get(7).unwrap_or("").to_string(),
                    source,
                    usage_used,
                    usage_remaining,
                    usage_total,
                    usage_percentage,
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
            "Source",
            "Usage Used",
            "Usage Remaining",
            "Usage Total",
            "Usage Percentage",
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
                &account.source,
                &account
                    .usage_used
                    .map(|v| v.to_string())
                    .unwrap_or_default(),
                &account
                    .usage_remaining
                    .map(|v| v.to_string())
                    .unwrap_or_default(),
                &account
                    .usage_total
                    .map(|v| v.to_string())
                    .unwrap_or_default(),
                &account
                    .usage_percentage
                    .map(|v| v.to_string())
                    .unwrap_or_default(),
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

        // Parse format: email,accessToken,sessionToken
        let parts: Vec<&str> = line.split(',').map(|s| s.trim()).collect();

        if parts.len() < 2 {
            anyhow::bail!("Invalid format. Expected: email,accessToken,sessionToken");
        }

        let email = parts[0].to_string();
        let access_token = parts[1].to_string();
        let session_token = parts.get(2).unwrap_or(&"").to_string();

        Ok(Account {
            index: 0, // Will be auto-assigned
            email,
            access_token: access_token.clone(),
            refresh_token: access_token, // Same as access token usually
            cookie: session_token,
            days_remaining: "0".to_string(),
            status: "unknown".to_string(),
            record_time: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            source: "imported".to_string(),
            usage_used: None,
            usage_remaining: None,
            usage_total: None,
            usage_percentage: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_manager() -> (CsvManager, tempfile::TempDir) {
        let temp_dir = tempfile::tempdir().unwrap();
        let csv_path = temp_dir.path().join("test.csv");
        let manager = CsvManager::new(csv_path);
        (manager, temp_dir)
    }

    #[test]
    fn test_ensure_csv_exists_creates_file() {
        let (manager, _temp_dir) = create_test_manager();

        assert!(!manager.file_path.exists());
        manager.ensure_csv_exists().unwrap();
        assert!(manager.file_path.exists());
    }

    #[test]
    fn test_write_and_read_accounts() {
        let (manager, _temp_dir) = create_test_manager();
        manager.ensure_csv_exists().unwrap();

        let accounts = vec![
            Account {
                index: 1,
                email: "test1@example.com".to_string(),
                access_token: "token1".to_string(),
                refresh_token: "refresh1".to_string(),
                cookie: "cookie1".to_string(),
                days_remaining: "30".to_string(),
                status: "premium".to_string(),
                record_time: "2024-01-01".to_string(),
                source: "imported".to_string(),
                usage_used: None,
                usage_remaining: None,
                usage_total: None,
                usage_percentage: None,
            },
            Account {
                index: 2,
                email: "test2@example.com".to_string(),
                access_token: "token2".to_string(),
                refresh_token: "refresh2".to_string(),
                cookie: "cookie2".to_string(),
                days_remaining: "15".to_string(),
                status: "free".to_string(),
                record_time: "2024-01-02".to_string(),
                source: "imported".to_string(),
                usage_used: None,
                usage_remaining: None,
                usage_total: None,
                usage_percentage: None,
            },
        ];

        manager.write_accounts(&accounts).unwrap();
        let read_accounts = manager.read_accounts().unwrap();

        assert_eq!(read_accounts.len(), 2);
        assert_eq!(read_accounts[0].email, "test1@example.com");
        assert_eq!(read_accounts[1].email, "test2@example.com");
    }

    #[test]
    fn test_add_account() {
        let (manager, _temp_dir) = create_test_manager();
        manager.ensure_csv_exists().unwrap();

        let account = Account {
            index: 0, // Should be auto-incremented
            email: "new@example.com".to_string(),
            access_token: "token".to_string(),
            refresh_token: "refresh".to_string(),
            cookie: "cookie".to_string(),
            days_remaining: "30".to_string(),
            status: "premium".to_string(),
            record_time: "2024-01-01".to_string(),
            source: "imported".to_string(),
            usage_used: None,
            usage_remaining: None,
            usage_total: None,
            usage_percentage: None,
        };

        manager.add_account(account).unwrap();
        let accounts = manager.read_accounts().unwrap();

        assert_eq!(accounts.len(), 1);
        assert_eq!(accounts[0].index, 1);
        assert_eq!(accounts[0].email, "new@example.com");
    }

    #[test]
    fn test_delete_account() {
        let (manager, _temp_dir) = create_test_manager();
        manager.ensure_csv_exists().unwrap();

        let account = Account {
            index: 1,
            email: "delete@example.com".to_string(),
            access_token: "token".to_string(),
            refresh_token: "refresh".to_string(),
            cookie: "cookie".to_string(),
            days_remaining: "30".to_string(),
            status: "premium".to_string(),
            record_time: "2024-01-01".to_string(),
            source: "imported".to_string(),
            usage_used: None,
            usage_remaining: None,
            usage_total: None,
            usage_percentage: None,
        };

        manager.add_account(account).unwrap();
        assert_eq!(manager.read_accounts().unwrap().len(), 1);

        let deleted = manager.delete_account("delete@example.com").unwrap();
        assert!(deleted);
        assert_eq!(manager.read_accounts().unwrap().len(), 0);
    }

    #[test]
    fn test_delete_nonexistent_account() {
        let (manager, _temp_dir) = create_test_manager();
        manager.ensure_csv_exists().unwrap();

        let deleted = manager.delete_account("nonexistent@example.com").unwrap();
        assert!(!deleted);
    }

    #[test]
    fn test_update_account() {
        let (manager, _temp_dir) = create_test_manager();
        manager.ensure_csv_exists().unwrap();

        let account = Account {
            index: 1,
            email: "update@example.com".to_string(),
            access_token: "old_token".to_string(),
            refresh_token: "refresh".to_string(),
            cookie: "cookie".to_string(),
            days_remaining: "30".to_string(),
            status: "premium".to_string(),
            record_time: "2024-01-01".to_string(),
            source: "imported".to_string(),
            usage_used: None,
            usage_remaining: None,
            usage_total: None,
            usage_percentage: None,
        };

        manager.add_account(account).unwrap();

        let updated_account = Account {
            index: 1,
            email: "update@example.com".to_string(),
            access_token: "new_token".to_string(),
            refresh_token: "refresh".to_string(),
            cookie: "cookie".to_string(),
            days_remaining: "45".to_string(),
            status: "ultra".to_string(),
            record_time: "2024-01-02".to_string(),
            source: "imported".to_string(),
            usage_used: None,
            usage_remaining: None,
            usage_total: None,
            usage_percentage: None,
        };

        let updated = manager
            .update_account("update@example.com", updated_account)
            .unwrap();
        assert!(updated);

        let accounts = manager.read_accounts().unwrap();
        assert_eq!(accounts[0].access_token, "new_token");
        assert_eq!(accounts[0].days_remaining, "45");
    }

    #[test]
    fn test_parse_import_text() {
        let (manager, _temp_dir) = create_test_manager();

        let import_text = "user1@example.com,token1,session1\nuser2@example.com,token2,session2";

        let accounts = manager.parse_import_text(import_text).unwrap();
        assert_eq!(accounts.len(), 2);
        assert_eq!(accounts[0].email, "user1@example.com");
        assert_eq!(accounts[0].access_token, "token1");
        assert_eq!(accounts[0].cookie, "session1");
        assert_eq!(accounts[1].email, "user2@example.com");
        assert_eq!(accounts[1].access_token, "token2");
        assert_eq!(accounts[1].cookie, "session2");
    }

    #[test]
    fn test_parse_account_line_with_session_token() {
        let (manager, _temp_dir) = create_test_manager();

        let line = "test@example.com,mytoken,mysession";
        let account = manager.parse_account_line(line).unwrap();

        assert_eq!(account.email, "test@example.com");
        assert_eq!(account.access_token, "mytoken");
        assert_eq!(account.refresh_token, "mytoken");
        assert_eq!(account.cookie, "mysession");
    }

    #[test]
    fn test_parse_account_line_without_session_token() {
        let (manager, _temp_dir) = create_test_manager();

        let line = "test@example.com,mytoken";
        let account = manager.parse_account_line(line).unwrap();

        assert_eq!(account.email, "test@example.com");
        assert_eq!(account.access_token, "mytoken");
        assert_eq!(account.cookie, "");
    }

    #[test]
    fn test_parse_account_line_invalid_format() {
        let (manager, _temp_dir) = create_test_manager();

        let line = "test@example.com";
        let result = manager.parse_account_line(line);

        assert!(result.is_err());
    }
}
