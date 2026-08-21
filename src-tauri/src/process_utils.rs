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
    /// Asks Cursor to quit, then force-kills it if it is still running.
    ///
    /// # Returns
    /// * `Ok(())` if Cursor is no longer running
    /// * `Err` if Cursor is still running after the final force-kill wait
    pub fn kill_cursor() -> Result<()> {
        Self::request_graceful_quit();
        let _ = Self::wait_for_cursor_exit(GRACEFUL_QUIT_TIMEOUT);

        if Self::is_cursor_running() {
            Self::send_term_signal();
            let _ = Self::wait_for_cursor_exit(TERM_WAIT_TIMEOUT);
        }

        if Self::is_cursor_running() {
            Self::force_kill_cursor();
            let _ = Self::wait_for_cursor_exit(FORCE_WAIT_TIMEOUT);
        }

        if Self::is_cursor_running() {
            anyhow::bail!("Cursor did not exit");
        }

        // Give Cursor time to release SQLite / storage file locks
        thread::sleep(FILE_LOCK_SETTLE);
        Ok(())
    }

    /// Asks Cursor to quit without a force-kill (Windows `taskkill` without `/F`).
    #[cfg(target_os = "windows")]
    fn request_graceful_quit() {
        let _ = Command::new("taskkill")
            .args(["/IM", "Cursor.exe"])
            .output();
    }

    /// Asks Cursor to quit via AppleScript (`tell application "Cursor" to quit`).
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

    /// Sends a default terminate signal to Cursor on Linux (`killall` / `pkill`).
    #[cfg(target_os = "linux")]
    fn request_graceful_quit() {
        if Command::new("killall").arg("cursor").output().is_err() {
            let _ = Command::new("pkill").args(["-x", "cursor"]).output();
        }
        let _ = Command::new("pkill").args(["-x", "Cursor"]).output();
    }

    /// Windows already requested quit via `taskkill`; no extra TERM step.
    #[cfg(target_os = "windows")]
    fn send_term_signal() {}

    /// Sends SIGTERM to the exact `Cursor` process name on macOS.
    #[cfg(target_os = "macos")]
    fn send_term_signal() {
        // Exact process name only — never `pkill -f Cursor`, which also matches
        // this app ("Cursor Account Switcher") and would abort the restart.
        let _ = Command::new("killall").arg("Cursor").output();
    }

    /// Linux already sent a terminate signal during the graceful-quit step.
    #[cfg(target_os = "linux")]
    fn send_term_signal() {}

    /// Force-kills Cursor on Windows with `taskkill /F`.
    #[cfg(target_os = "windows")]
    fn force_kill_cursor() {
        let _ = Command::new("taskkill")
            .args(["/F", "/IM", "Cursor.exe"])
            .output();
    }

    /// Force-kills Cursor and its helper processes on macOS with SIGKILL.
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

    /// Force-kills Cursor on Linux with `pkill -9`.
    #[cfg(target_os = "linux")]
    fn force_kill_cursor() {
        let _ = Command::new("pkill").args(["-9", "-x", "cursor"]).output();
        let _ = Command::new("pkill").args(["-9", "-x", "Cursor"]).output();
    }

    /// Polls until Cursor has exited or `timeout` elapses.
    ///
    /// # Returns
    /// * `true` if Cursor is no longer running
    /// * `false` if the process is still running after the timeout
    pub fn wait_for_cursor_exit(timeout: Duration) -> bool {
        let start = Instant::now();
        while start.elapsed() < timeout {
            if !Self::is_cursor_running() {
                return true;
            }
            thread::sleep(EXIT_POLL_INTERVAL);
        }
        !Self::is_cursor_running()
    }

    /// Returns whether a Cursor editor process is currently running.
    #[cfg(target_os = "windows")]
    pub fn is_cursor_running() -> bool {
        Command::new("tasklist")
            .args(["/FI", "IMAGENAME eq Cursor.exe", "/NH"])
            .output()
            .map(|output| String::from_utf8_lossy(&output.stdout).contains("Cursor.exe"))
            .unwrap_or(false)
    }

    /// Returns whether a Cursor editor process is currently running.
    #[cfg(target_os = "macos")]
    pub fn is_cursor_running() -> bool {
        Command::new("pgrep")
            .args(["-x", "Cursor"])
            .status()
            .map(|status| status.success())
            .unwrap_or(false)
    }

    /// Returns whether a Cursor editor process is currently running.
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

    /// Launches Cursor after confirming the previous instance has exited.
    ///
    /// # Arguments
    /// * `cursor_path` - Optional path to the Cursor executable
    ///
    /// # Returns
    /// * `Ok(())` if Cursor was launched
    /// * `Err` if Cursor is still running or the launch command fails
    #[cfg(target_os = "windows")]
    pub fn restart_cursor(cursor_path: Option<String>) -> Result<()> {
        if !Self::wait_for_cursor_exit(GRACEFUL_QUIT_TIMEOUT) {
            anyhow::bail!("Cursor is still running");
        }

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

    /// Launches Cursor after confirming the previous instance has exited.
    ///
    /// # Arguments
    /// * `cursor_path` - Optional path to the Cursor application bundle
    ///
    /// # Returns
    /// * `Ok(())` if Cursor was launched
    /// * `Err` if Cursor is still running or the launch command fails
    #[cfg(target_os = "macos")]
    pub fn restart_cursor(cursor_path: Option<String>) -> Result<()> {
        if !Self::wait_for_cursor_exit(GRACEFUL_QUIT_TIMEOUT) {
            anyhow::bail!("Cursor is still running");
        }
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

    /// Launches Cursor after confirming the previous instance has exited.
    ///
    /// # Arguments
    /// * `cursor_path` - Optional path to the Cursor binary
    ///
    /// # Returns
    /// * `Ok(())` if Cursor was launched
    /// * `Err` if Cursor is still running or the launch command fails
    #[cfg(target_os = "linux")]
    pub fn restart_cursor(cursor_path: Option<String>) -> Result<()> {
        if !Self::wait_for_cursor_exit(GRACEFUL_QUIT_TIMEOUT) {
            anyhow::bail!("Cursor is still running");
        }
        thread::sleep(FILE_LOCK_SETTLE);

        let path = cursor_path.as_deref().unwrap_or("cursor");
        Command::new(path)
            .spawn()
            .with_context(|| format!("Failed to launch Cursor ({})", path))?;

        Ok(())
    }
}
