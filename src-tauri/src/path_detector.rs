use anyhow::Result;
use std::path::{Path, PathBuf};

pub struct PathDetector;

impl PathDetector {
    #[cfg(target_os = "windows")]
    pub fn detect_cursor_path() -> Result<PathBuf> {
        let appdata = std::env::var("APPDATA")?;
        let base_path = PathBuf::from(appdata)
            .join("Cursor")
            .join("User")
            .join("globalStorage");

        if base_path.exists() {
            Ok(base_path)
        } else {
            anyhow::bail!("Cursor path not found at: {:?}", base_path)
        }
    }

    #[cfg(target_os = "macos")]
    pub fn detect_cursor_path() -> Result<PathBuf> {
        let home = std::env::var("HOME")?;
        let base_path = PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join("Cursor")
            .join("User")
            .join("globalStorage");

        if base_path.exists() {
            Ok(base_path)
        } else {
            anyhow::bail!("Cursor path not found at: {:?}", base_path)
        }
    }

    #[cfg(target_os = "linux")]
    pub fn detect_cursor_path() -> Result<PathBuf> {
        let home = std::env::var("HOME")?;
        let base_path = PathBuf::from(home)
            .join(".config")
            .join("Cursor")
            .join("User")
            .join("globalStorage");

        if base_path.exists() {
            Ok(base_path)
        } else {
            anyhow::bail!("Cursor path not found at: {:?}", base_path)
        }
    }

    pub fn get_db_path(base_path: &Path) -> PathBuf {
        base_path.join("state.vscdb")
    }

    pub fn get_storage_path(base_path: &Path) -> PathBuf {
        base_path.join("storage.json")
    }
}
