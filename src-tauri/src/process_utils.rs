use anyhow::Result;
use std::process::Command;

pub struct ProcessManager;

impl ProcessManager {
    #[cfg(target_os = "windows")]
    pub fn kill_cursor() -> Result<()> {
        // Kill Cursor.exe process on Windows
        let output = Command::new("taskkill")
            .args(["/F", "/IM", "Cursor.exe"])
            .output();

        match output {
            Ok(_) => Ok(()),
            Err(e) => {
                // Process might not be running, which is fine
                eprintln!("Note: Cursor process may not be running: {}", e);
                Ok(())
            }
        }
    }

    #[cfg(target_os = "macos")]
    pub fn kill_cursor() -> Result<()> {
        // Kill Cursor process on macOS
        let output = Command::new("pkill").arg("-f").arg("Cursor").output();

        match output {
            Ok(_) => Ok(()),
            Err(e) => {
                eprintln!("Note: Cursor process may not be running: {}", e);
                Ok(())
            }
        }
    }

    #[cfg(target_os = "linux")]
    pub fn kill_cursor() -> Result<()> {
        // Kill Cursor process on Linux
        let output = Command::new("pkill").arg("-f").arg("cursor").output();

        match output {
            Ok(_) => Ok(()),
            Err(e) => {
                eprintln!("Note: Cursor process may not be running: {}", e);
                Ok(())
            }
        }
    }

    #[cfg(target_os = "windows")]
    pub fn restart_cursor(cursor_path: Option<String>) -> Result<()> {
        let default_path = r"C:\Users\%USERNAME%\AppData\Local\Programs\cursor\Cursor.exe";
        let path = cursor_path.as_deref().unwrap_or(default_path);

        Command::new(path).spawn().map(|_| ()).or_else(|_| {
            // Try alternative path
            Command::new(r"C:\Program Files\Cursor\Cursor.exe")
                .spawn()
                .map(|_| ())
        })?;

        Ok(())
    }

    #[cfg(target_os = "macos")]
    pub fn restart_cursor(cursor_path: Option<String>) -> Result<()> {
        let default_path = "/Applications/Cursor.app";
        let path = cursor_path.as_deref().unwrap_or(default_path);

        Command::new("open")
            .arg("-a")
            .arg(path)
            .spawn()
            .map(|_| ())?;

        Ok(())
    }

    #[cfg(target_os = "linux")]
    pub fn restart_cursor(cursor_path: Option<String>) -> Result<()> {
        let default_path = "cursor";
        let path = cursor_path.as_deref().unwrap_or(default_path);

        Command::new(path).spawn().map(|_| ())?;

        Ok(())
    }
}
