use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use tracing_appender::non_blocking::WorkerGuard;
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub level: String,
    pub message: String,
}

pub struct Logger {
    log_path: PathBuf,
}

impl Logger {
    pub fn new(log_dir: PathBuf) -> Self {
        Self {
            log_path: log_dir.join("app.log"),
        }
    }

    /// Initialize the logging system
    pub fn init(log_dir: PathBuf) -> Result<WorkerGuard> {
        // Create log directory if it doesn't exist
        fs::create_dir_all(&log_dir)?;

        // Set up file appender (non-rolling for simplicity)
        let log_file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(log_dir.join("app.log"))?;
        
        let (non_blocking, guard) = tracing_appender::non_blocking(log_file);

        // Create filter (INFO level by default)
        let filter = EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| EnvFilter::new("info"));

        // Set up logging to file
        let file_layer = fmt::layer()
            .with_writer(non_blocking)
            .with_ansi(false)
            .with_target(false)
            .with_thread_ids(false)
            .with_file(false)
            .with_line_number(false);

        // Set up logging to stdout (for development)
        let stdout_layer = fmt::layer()
            .with_writer(std::io::stdout)
            .with_target(false)
            .with_thread_ids(false);

        // Combine both layers
        tracing_subscriber::registry()
            .with(filter)
            .with(file_layer)
            .with(stdout_layer)
            .init();

        tracing::info!("Logger initialized at: {}", log_dir.display());

        Ok(guard)
    }

    /// Read all log entries from the log file
    pub fn read_logs(&self) -> Result<Vec<LogEntry>> {
        if !self.log_path.exists() {
            return Ok(Vec::new());
        }

        let file = File::open(&self.log_path)?;
        let reader = BufReader::new(file);
        let mut entries = Vec::new();

        for line in reader.lines() {
            let line = line?;
            if line.trim().is_empty() {
                continue;
            }

            // Parse log line format: "2023-10-28T12:34:56.789Z  INFO message"
            let entry = self.parse_log_line(&line);
            if let Some(entry) = entry {
                entries.push(entry);
            }
        }

        Ok(entries)
    }

    /// Parse a single log line
    fn parse_log_line(&self, line: &str) -> Option<LogEntry> {
        // Expected format: "2023-10-28T12:34:56.789Z  INFO message here"
        // Note: There are two spaces between timestamp and level
        
        // Split by whitespace and filter out empty strings
        let parts: Vec<&str> = line.split_whitespace().collect();
        
        if parts.len() >= 3 {
            let timestamp = parts[0].to_string();
            let level = parts[1].to_string();
            // Join the rest as the message
            let message = parts[2..].join(" ");

            Some(LogEntry {
                timestamp,
                level,
                message,
            })
        } else if !line.trim().is_empty() {
            // If parsing fails, return the whole line as a message
            Some(LogEntry {
                timestamp: chrono::Local::now().to_rfc3339(),
                level: "INFO".to_string(),
                message: line.to_string(),
            })
        } else {
            None
        }
    }

    /// Clear all logs
    pub fn clear_logs(&self) -> Result<()> {
        if self.log_path.exists() {
            fs::write(&self.log_path, "")?;
            tracing::info!("Logs cleared");
        }
        Ok(())
    }

    /// Get the log file path
    pub fn get_log_path(&self) -> PathBuf {
        self.log_path.clone()
    }
}

// Helper macros to make logging easier throughout the app
#[macro_export]
macro_rules! log_info {
    ($($arg:tt)*) => {
        tracing::info!($($arg)*);
    };
}

#[macro_export]
macro_rules! log_warn {
    ($($arg:tt)*) => {
        tracing::warn!($($arg)*);
    };
}

#[macro_export]
macro_rules! log_error {
    ($($arg:tt)*) => {
        tracing::error!($($arg)*);
    };
}

#[macro_export]
macro_rules! log_debug {
    ($($arg:tt)*) => {
        tracing::debug!($($arg)*);
    };
}

