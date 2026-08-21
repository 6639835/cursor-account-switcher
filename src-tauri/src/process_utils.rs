use anyhow::{Context, Result};
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

const GRACEFUL_QUIT_TIMEOUT: Duration = Duration::from_secs(10);
const TERM_WAIT_TIMEOUT: Duration = Duration::from_secs(4);
const FORCE_WAIT_TIMEOUT: Duration = Duration::from_secs(3);
const EXIT_POLL_INTERVAL: Duration = Duration::from_millis(200);
const FILE_LOCK_SETTLE: Duration = Duration::from_millis(400);

pub struct ProcessManager;

impl ProcessManager {
    pub fn kill_cursor() -> Result<()> {
        Self::request_graceful_quit();
        Self::wait_for_cursor_exit(GRACEFUL_QUIT_TIMEOUT);

        if Self::is_cursor_running() {
            Self::send_term_signal();
            Self::wait_for_cursor_exit(TERM_WAIT_TIMEOUT);
        }

        if Self::is_cursor_running() {
            Self::force_kill_cursor();
            Self::wait_for_cursor_exit(FORCE_WAIT_TIMEOUT);
        }

        // Give Cursor time to release SQLite / storage file locks
        thread::sleep(FILE_LOCK_SETTLE);
        Ok(())
    }

    #[cfg(target_os = "windows")]
    fn request_graceful_quit() {
        let _ = Command::new("taskkill")
            .args(["/IM", "Cursor.exe"])
            .output();
    }

    #[cfg(target_os = "macos")]
    fn request_graceful_quit() {
        if !Self::is_cursor_running() {
            return;
        }

        // Cmd+Q equivalent — Electron shuts down cleanly and will not show
        // "killed unexpectedly (error 9)" on the next launch.
        let Ok(mut child) = Command::new("osascript")
            .args(["-e", "tell application \"Cursor\" to quit"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
        else {
            return;
        };

        let deadline = Instant::now() + GRACEFUL_QUIT_TIMEOUT;
        loop {
            if !Self::is_cursor_running() {
                let _ = child.kill();
                let _ = child.wait();
                return;
            }

            match child.try_wait() {
                Ok(Some(_)) => return,
                Ok(None) if Instant::now() < deadline => {
                    thread::sleep(EXIT_POLL_INTERVAL);
                }
                _ => {
                    let _ = child.kill();
                    let _ = child.wait();
                    return;
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    fn request_graceful_quit() {
        if Command::new("killall").arg("cursor").output().is_err() {
            let _ = Command::new("pkill").args(["-x", "cursor"]).output();
        }
        let _ = Command::new("pkill").args(["-x", "Cursor"]).output();
    }

    #[cfg(target_os = "windows")]
    fn send_term_signal() {}

    #[cfg(target_os = "macos")]
    fn send_term_signal() {
        // Exact process name only — never `pkill -f Cursor`, which also matches
        // this app ("Cursor Account Switcher") and would abort the restart.
        let _ = Command::new("killall").arg("Cursor").output();
    }

    #[cfg(target_os = "linux")]
    fn send_term_signal() {}

    #[cfg(target_os = "windows")]
    fn force_kill_cursor() {
        let _ = Command::new("taskkill")
            .args(["/F", "/IM", "Cursor.exe"])
            .output();
    }

    #[cfg(target_os = "macos")]
    fn force_kill_cursor() {
        let _ = Command::new("killall").args(["-9", "Cursor"]).output();
        for name in [
            "Cursor Helper",
            "Cursor Helper (GPU)",
            "Cursor Helper (Renderer)",
            "Cursor Helper (Plugin)",
        ] {
            let _ = Command::new("killall").args(["-9", name]).output();
        }
    }

    #[cfg(target_os = "linux")]
    fn force_kill_cursor() {
        let _ = Command::new("pkill").args(["-9", "-x", "cursor"]).output();
        let _ = Command::new("pkill").args(["-9", "-x", "Cursor"]).output();
    }

    pub fn wait_for_cursor_exit(timeout: Duration) {
        let start = Instant::now();
        while start.elapsed() < timeout {
            if !Self::is_cursor_running() {
                return;
            }
            thread::sleep(EXIT_POLL_INTERVAL);
        }
    }

    #[cfg(target_os = "windows")]
    pub fn is_cursor_running() -> bool {
        Command::new("tasklist")
            .args(["/FI", "IMAGENAME eq Cursor.exe", "/NH"])
            .output()
            .map(|output| String::from_utf8_lossy(&output.stdout).contains("Cursor.exe"))
            .unwrap_or(false)
    }

    #[cfg(target_os = "macos")]
    pub fn is_cursor_running() -> bool {
        Command::new("pgrep")
            .args(["-x", "Cursor"])
            .status()
            .map(|status| status.success())
            .unwrap_or(false)
    }

    #[cfg(target_os = "linux")]
    pub fn is_cursor_running() -> bool {
        let named_cursor = Command::new("pgrep")
            .args(["-x", "cursor"])
            .status()
            .map(|status| status.success())
            .unwrap_or(false);
        let named_cursor_caps = Command::new("pgrep")
            .args(["-x", "Cursor"])
            .status()
            .map(|status| status.success())
            .unwrap_or(false);
        named_cursor || named_cursor_caps
    }

    #[cfg(target_os = "windows")]
    pub fn restart_cursor(cursor_path: Option<String>) -> Result<()> {
        Self::wait_for_cursor_exit(GRACEFUL_QUIT_TIMEOUT);

        if let Some(path) = cursor_path {
            Command::new(&path)
                .spawn()
                .with_context(|| format!("Failed to launch Cursor at {}", path))?;
            return Ok(());
        }

        let local_appdata = std::env::var("LOCALAPPDATA").unwrap_or_default();
        let user_install = format!(r"{}\Programs\cursor\Cursor.exe", local_appdata);

        Command::new(&user_install)
            .spawn()
            .map(|_| ())
            .or_else(|_| {
                Command::new(r"C:\Program Files\Cursor\Cursor.exe")
                    .spawn()
                    .map(|_| ())
            })
            .context("Failed to launch Cursor")?;

        Ok(())
    }

    #[cfg(target_os = "macos")]
    pub fn restart_cursor(cursor_path: Option<String>) -> Result<()> {
        Self::wait_for_cursor_exit(GRACEFUL_QUIT_TIMEOUT);
        thread::sleep(FILE_LOCK_SETTLE);

        if let Some(path) = cursor_path {
            let status = Command::new("open")
                .arg(&path)
                .status()
                .with_context(|| format!("Failed to launch Cursor at {}", path))?;
            if !status.success() {
                anyhow::bail!("Failed to reopen Cursor at {}", path);
            }
            return Ok(());
        }

        // Launch Services by app name is more reliable than a hardcoded path
        let by_name = Command::new("open").args(["-a", "Cursor"]).status();
        if let Ok(status) = by_name {
            if status.success() {
                return Ok(());
            }
        }

        let status = Command::new("open")
            .arg("/Applications/Cursor.app")
            .status()
            .context("Failed to launch Cursor")?;
        if !status.success() {
            anyhow::bail!("Failed to reopen Cursor");
        }

        Ok(())
    }

    #[cfg(target_os = "linux")]
    pub fn restart_cursor(cursor_path: Option<String>) -> Result<()> {
        Self::wait_for_cursor_exit(GRACEFUL_QUIT_TIMEOUT);
        thread::sleep(FILE_LOCK_SETTLE);

        let path = cursor_path.as_deref().unwrap_or("cursor");
        Command::new(path)
            .spawn()
            .with_context(|| format!("Failed to launch Cursor ({})", path))?;

        Ok(())
    }
}
