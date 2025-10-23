use anyhow::{Context, Result as AnyhowResult};
use rusqlite::Connection;
use std::path::PathBuf;

pub struct Database {
    path: PathBuf,
}

impl Database {
    pub fn new(db_path: PathBuf) -> Self {
        Self { path: db_path }
    }

    pub fn get_auth_info(&self) -> AnyhowResult<(String, String)> {
        let conn = Connection::open(&self.path).context("Failed to open database")?;

        // Get email from database (stored separately)
        let email: String = conn
            .query_row(
                "SELECT value FROM ItemTable WHERE key = 'cursorAuth/cachedEmail'",
                [],
                |row| row.get(0),
            )
            .context("Failed to get email from database")?;

        // Get access token from database
        let access_token: String = conn
            .query_row(
                "SELECT value FROM ItemTable WHERE key = 'cursorAuth/accessToken'",
                [],
                |row| row.get(0),
            )
            .context("Failed to get access token")?;

        Ok((email, access_token))
    }

    pub fn update_auth(
        &self,
        email: &str,
        access_token: &str,
        refresh_token: Option<&str>,
    ) -> AnyhowResult<()> {
        let conn = Connection::open(&self.path)
            .context(format!("Failed to open database for user {}", email))?;

        // Update email (stored separately from token)
        conn.execute(
            "INSERT OR REPLACE INTO ItemTable (key, value) VALUES ('cursorAuth/cachedEmail', ?1)",
            [email],
        )?;

        // Update access token
        conn.execute(
            "INSERT OR REPLACE INTO ItemTable (key, value) VALUES ('cursorAuth/accessToken', ?1)",
            [access_token],
        )?;

        // Update refresh token if provided
        if let Some(refresh_token) = refresh_token {
            conn.execute(
                "INSERT OR REPLACE INTO ItemTable (key, value) VALUES ('cursorAuth/refreshToken', ?1)",
                [refresh_token],
            )?;
        }

        // Set signup type (indicates authentication status)
        conn.execute(
            "INSERT OR REPLACE INTO ItemTable (key, value) VALUES ('cursorAuth/cachedSignUpType', ?1)",
            ["Auth_0"],
        )?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn create_test_db() -> (Database, tempfile::TempDir) {
        let temp_dir = tempfile::tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");

        // Create a test database with the required schema
        let conn = Connection::open(&db_path).unwrap();
        conn.execute(
            "CREATE TABLE IF NOT EXISTS ItemTable (
                key TEXT PRIMARY KEY,
                value TEXT
            )",
            [],
        )
        .unwrap();

        let db = Database::new(db_path);
        (db, temp_dir)
    }

    #[test]
    fn test_update_auth() {
        let (db, _temp_dir) = create_test_db();

        let email = "test@example.com";
        let access_token = "test_access_token";
        let refresh_token = Some("test_refresh_token");

        db.update_auth(email, access_token, refresh_token).unwrap();

        // Verify the data was written correctly
        let conn = Connection::open(&db.path).unwrap();

        let stored_email: String = conn
            .query_row(
                "SELECT value FROM ItemTable WHERE key = 'cursorAuth/cachedEmail'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(stored_email, email);

        let stored_token: String = conn
            .query_row(
                "SELECT value FROM ItemTable WHERE key = 'cursorAuth/accessToken'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(stored_token, access_token);

        let stored_refresh: String = conn
            .query_row(
                "SELECT value FROM ItemTable WHERE key = 'cursorAuth/refreshToken'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(stored_refresh, "test_refresh_token");
    }

    #[test]
    fn test_get_auth_info() {
        let (db, _temp_dir) = create_test_db();

        // First insert some auth data
        let email = "gettest@example.com";
        let access_token = "get_test_token";

        let conn = Connection::open(&db.path).unwrap();
        conn.execute(
            "INSERT INTO ItemTable (key, value) VALUES ('cursorAuth/cachedEmail', ?1)",
            [email],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO ItemTable (key, value) VALUES ('cursorAuth/accessToken', ?1)",
            [access_token],
        )
        .unwrap();

        // Now test get_auth_info
        let (retrieved_email, retrieved_token) = db.get_auth_info().unwrap();
        assert_eq!(retrieved_email, email);
        assert_eq!(retrieved_token, access_token);
    }

    #[test]
    fn test_get_auth_info_missing_data() {
        let (db, _temp_dir) = create_test_db();

        // Try to get auth info when no data exists
        let result = db.get_auth_info();
        assert!(result.is_err());
    }

    #[test]
    fn test_update_auth_without_refresh_token() {
        let (db, _temp_dir) = create_test_db();

        let email = "norefresh@example.com";
        let access_token = "access_only";

        db.update_auth(email, access_token, None).unwrap();

        let conn = Connection::open(&db.path).unwrap();

        let stored_email: String = conn
            .query_row(
                "SELECT value FROM ItemTable WHERE key = 'cursorAuth/cachedEmail'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(stored_email, email);

        // Refresh token should not be in database
        let refresh_result: Result<String, _> = conn.query_row(
            "SELECT value FROM ItemTable WHERE key = 'cursorAuth/refreshToken'",
            [],
            |row| row.get(0),
        );
        // It's ok if it doesn't exist or has no value
        assert!(refresh_result.is_err() || refresh_result.unwrap().is_empty());
    }

    #[test]
    fn test_update_auth_sets_signup_type() {
        let (db, _temp_dir) = create_test_db();

        db.update_auth("test@example.com", "token", None).unwrap();

        let conn = Connection::open(&db.path).unwrap();
        let signup_type: String = conn
            .query_row(
                "SELECT value FROM ItemTable WHERE key = 'cursorAuth/cachedSignUpType'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(signup_type, "Auth_0");
    }

    #[test]
    fn test_update_auth_replaces_existing() {
        let (db, _temp_dir) = create_test_db();

        // Insert initial data
        db.update_auth("first@example.com", "first_token", Some("first_refresh"))
            .unwrap();

        // Update with new data
        db.update_auth("second@example.com", "second_token", Some("second_refresh"))
            .unwrap();

        // Verify it was replaced, not duplicated
        let (email, token) = db.get_auth_info().unwrap();
        assert_eq!(email, "second@example.com");
        assert_eq!(token, "second_token");
    }
}
