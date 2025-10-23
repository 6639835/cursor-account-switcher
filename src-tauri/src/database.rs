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
