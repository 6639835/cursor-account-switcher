// Prevents additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod api_client;
mod csv_manager;
mod database;
mod detailed_usage_client;
mod logger;
mod machine_id;
mod path_detector;
mod process_utils;
mod reset_machine;
mod token_auth;
mod types;

use api_client::CursorApiClient;
use csv_manager::CsvManager;
use database::Database;
use detailed_usage_client::DetailedUsageClient;
use logger::{LogEntry, Logger};
use path_detector::PathDetector;
use process_utils::ProcessManager;
use reset_machine::MachineIdResetter;
use types::*;

use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{
    CustomMenuItem, Manager, State, SystemTray, SystemTrayEvent, SystemTrayMenu,
    SystemTrayMenuItem, WindowEvent,
};
use tracing_appender::non_blocking::WorkerGuard;

// Global state
struct AppState {
    csv_path: Mutex<PathBuf>,
    cursor_base_path: Mutex<Option<PathBuf>>,
    log_path: Mutex<PathBuf>,
    _log_guard: Mutex<Option<WorkerGuard>>,
}

// Initialize app state with placeholder
fn init_app_state() -> AppState {
    // Placeholder - will be set properly in setup()
    AppState {
        csv_path: Mutex::new(PathBuf::from(".")),
        cursor_base_path: Mutex::new(None),
        log_path: Mutex::new(PathBuf::from(".")),
        _log_guard: Mutex::new(None),
    }
}

#[tauri::command]
fn get_data_storage_path(state: State<AppState>) -> Result<String, String> {
    let csv_path = state.csv_path.lock().unwrap();
    Ok(csv_path.to_string_lossy().to_string())
}

#[tauri::command]
fn detect_cursor_path() -> Result<String, String> {
    PathDetector::detect_cursor_path()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn set_cursor_path(state: State<AppState>, path: String) -> Result<(), String> {
    let path_buf = PathBuf::from(path);
    let mut cursor_path = state.cursor_base_path.lock().unwrap();
    *cursor_path = Some(path_buf);
    Ok(())
}

#[tauri::command]
fn get_current_account_info(state: State<AppState>) -> Result<AccountInfo, String> {
    tracing::info!("Fetching current account info");
    let cursor_path = state.cursor_base_path.lock().unwrap();
    let base_path = cursor_path.as_ref().ok_or("Cursor path not set")?;

    let db_path = PathDetector::get_db_path(base_path);
    let db = Database::new(db_path);

    let (email, access_token) = db.get_auth_info().map_err(|e| {
        tracing::error!("Failed to get auth info: {}", e);
        e.to_string()
    })?;

    tracing::debug!("Fetching account info for: {}", email);
    let api_client = CursorApiClient::new();
    api_client
        .get_account_info(&email, &access_token)
        .map_err(|e| {
            tracing::error!("Failed to fetch account info: {}", e);
            e.to_string()
        })
}

#[tauri::command]
fn get_usage_info(state: State<AppState>) -> Result<UsageInfo, String> {
    let cursor_path = state.cursor_base_path.lock().unwrap();
    let base_path = cursor_path.as_ref().ok_or("Cursor path not set")?;

    let db_path = PathDetector::get_db_path(base_path);
    let db = Database::new(db_path);

    let (_, access_token) = db.get_auth_info().map_err(|e| e.to_string())?;

    let api_client = CursorApiClient::new();
    api_client
        .get_usage_info(&access_token)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_all_accounts(state: State<AppState>) -> Result<Vec<Account>, String> {
    let csv_path = state.csv_path.lock().unwrap();
    let csv_manager = CsvManager::new(csv_path.clone());

    csv_manager.ensure_csv_exists().map_err(|e| e.to_string())?;

    csv_manager.read_accounts().map_err(|e| e.to_string())
}

#[tauri::command]
fn add_account(state: State<AppState>, account: Account) -> Result<(), String> {
    let csv_path = state.csv_path.lock().unwrap();
    let csv_manager = CsvManager::new(csv_path.clone());

    csv_manager.add_account(account).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_account(state: State<AppState>, email: String) -> Result<bool, String> {
    let csv_path = state.csv_path.lock().unwrap();
    let csv_manager = CsvManager::new(csv_path.clone());

    csv_manager
        .delete_account(&email)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn update_account(state: State<AppState>, email: String, account: Account) -> Result<bool, String> {
    let csv_path = state.csv_path.lock().unwrap();
    let csv_manager = CsvManager::new(csv_path.clone());

    csv_manager
        .update_account(&email, account)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn import_accounts(state: State<AppState>, text: String) -> Result<Vec<Account>, String> {
    tracing::info!("Importing accounts from text");
    let csv_path = state.csv_path.lock().unwrap();
    let csv_manager = CsvManager::new(csv_path.clone());

    let result = csv_manager.parse_import_text(&text).map_err(|e| {
        tracing::error!("Failed to parse import text: {}", e);
        e.to_string()
    })?;

    tracing::info!("Successfully parsed {} account(s)", result.len());
    Ok(result)
}

#[tauri::command]
fn batch_add_accounts(state: State<AppState>, accounts: Vec<Account>) -> Result<(), String> {
    let csv_path = state.csv_path.lock().unwrap();
    let csv_manager = CsvManager::new(csv_path.clone());

    // Use the optimized batch add method instead of adding one by one
    csv_manager
        .batch_add_accounts(accounts)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn switch_account(
    state: State<AppState>,
    email: String,
    access_token: String,
    refresh_token: String,
    reset_machine: bool,
) -> Result<(), String> {
    tracing::info!("Switching to account: {}", email);
    let cursor_path = state.cursor_base_path.lock().unwrap();
    let base_path = cursor_path.as_ref().ok_or("Cursor path not set")?.clone();

    // Kill Cursor process
    tracing::info!("Killing Cursor process");
    ProcessManager::kill_cursor().map_err(|e| {
        tracing::error!("Failed to kill Cursor process: {}", e);
        e.to_string()
    })?;

    // Update database
    tracing::info!("Updating database with new credentials");
    let db_path = PathDetector::get_db_path(&base_path);
    let db = Database::new(db_path);

    db.update_auth(&email, &access_token, Some(&refresh_token))
        .map_err(|e| {
            tracing::error!("Failed to update database: {}", e);
            e.to_string()
        })?;

    // Reset machine ID if requested
    if reset_machine {
        tracing::info!("Resetting machine ID");
        let resetter = MachineIdResetter::new(base_path.clone());
        resetter.reset().map_err(|e| {
            tracing::error!("Machine ID reset failed: {}", e);
            format!("Machine ID reset failed: {}", e)
        })?;
    }

    tracing::info!("Account switch completed successfully");
    Ok(())
}

#[tauri::command]
fn reset_machine_id(state: State<AppState>) -> Result<(), String> {
    tracing::info!("Resetting machine ID");
    let cursor_path = state.cursor_base_path.lock().unwrap();
    let base_path = cursor_path.as_ref().ok_or("Cursor path not set")?.clone();

    let resetter = MachineIdResetter::new(base_path);
    resetter.reset().map_err(|e| {
        tracing::error!("Failed to reset machine ID: {}", e);
        e.to_string()
    })
}

#[tauri::command]
fn kill_cursor_process() -> Result<(), String> {
    ProcessManager::kill_cursor().map_err(|e| e.to_string())
}

#[tauri::command]
fn restart_cursor_process(cursor_app_path: Option<String>) -> Result<(), String> {
    ProcessManager::restart_cursor(cursor_app_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_account_info_from_api(
    state: State<AppState>,
    email: String,
    access_token: String,
) -> Result<Account, String> {
    let api_client = CursorApiClient::new();
    let account_info = api_client
        .get_account_info(&email, &access_token)
        .map_err(|e| e.to_string())?;

    let csv_path = state.csv_path.lock().unwrap();
    let csv_manager = CsvManager::new(csv_path.clone());

    let mut accounts = csv_manager.read_accounts().map_err(|e| e.to_string())?;

    // Find and update the account
    let updated_account = if let Some(account) = accounts.iter_mut().find(|a| a.email == email) {
        account.days_remaining = if account_info.days_remaining < 0.0 {
            "N/A".to_string()
        } else {
            format!("{:.1}", account_info.days_remaining)
        };
        account.status = account_info.membership_type.clone();
        account.record_time = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        account.clone()
    } else {
        return Err("Account not found".to_string());
    };

    csv_manager
        .write_accounts(&accounts)
        .map_err(|e| e.to_string())?;

    Ok(updated_account)
}

#[tauri::command]
fn batch_update_all_accounts(state: State<AppState>) -> Result<Vec<Account>, String> {
    tracing::info!("Starting batch update for all accounts");
    let csv_path = state.csv_path.lock().unwrap();
    let csv_manager = CsvManager::new(csv_path.clone());

    let mut accounts = csv_manager.read_accounts().map_err(|e| e.to_string())?;
    tracing::info!("Updating {} account(s)", accounts.len());

    let api_client = CursorApiClient::new();
    let mut success_count = 0;
    let mut error_count = 0;

    for account in &mut accounts {
        match api_client.get_account_info(&account.email, &account.access_token) {
            Ok(account_info) => {
                account.days_remaining = if account_info.days_remaining < 0.0 {
                    "N/A".to_string()
                } else {
                    format!("{:.1}", account_info.days_remaining)
                };
                account.status = account_info.membership_type;
                account.record_time = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

                // Fetch usage info
                match api_client.get_usage_info(&account.access_token) {
                    Ok(usage_info) => {
                        account.usage_used = Some(usage_info.used);
                        account.usage_remaining = Some(usage_info.remaining);
                        account.usage_total = Some(usage_info.total_quota);
                        account.usage_percentage = Some(usage_info.usage_percentage);
                    }
                    Err(e) => {
                        tracing::warn!("Failed to fetch usage info for {}: {}", account.email, e);
                        account.usage_used = None;
                        account.usage_remaining = None;
                        account.usage_total = None;
                        account.usage_percentage = None;
                    }
                }
                success_count += 1;
                tracing::debug!("Updated account: {}", account.email);
            }
            Err(e) => {
                tracing::error!("Failed to update account {}: {}", account.email, e);
                account.status = "error".to_string();
                error_count += 1;
            }
        }
    }

    csv_manager
        .write_accounts(&accounts)
        .map_err(|e| e.to_string())?;

    tracing::info!(
        "Batch update completed: {} successful, {} failed",
        success_count,
        error_count
    );
    Ok(accounts)
}

#[tauri::command]
fn sync_current_account(state: State<AppState>) -> Result<(), String> {
    let cursor_path = state.cursor_base_path.lock().unwrap();
    let base_path = cursor_path.as_ref().ok_or("Cursor path not set")?;

    let csv_path = state.csv_path.lock().unwrap();
    let csv_manager = CsvManager::new(csv_path.clone());

    // Get current account from Cursor's database
    let db_path = PathDetector::get_db_path(base_path);
    let db = Database::new(db_path);

    let (email, access_token) = match db.get_auth_info() {
        Ok(info) => info,
        Err(_) => {
            // No account logged in, just return
            return Ok(());
        }
    };

    // Read existing accounts
    let mut accounts = csv_manager.read_accounts().map_err(|e| e.to_string())?;

    // Check if account already exists
    let existing_account = accounts.iter_mut().find(|a| a.email == email);

    if let Some(account) = existing_account {
        // Update tokens but preserve source
        account.access_token = access_token.clone();
        account.refresh_token = access_token.clone();
        account.record_time = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

        csv_manager
            .write_accounts(&accounts)
            .map_err(|e| e.to_string())?;
    } else {
        // Add new account with source="web_login"
        let new_account = Account {
            index: 0, // Will be auto-assigned
            email: email.clone(),
            access_token: access_token.clone(),
            refresh_token: access_token,
            cookie: String::new(),
            days_remaining: "N/A".to_string(),
            status: "unknown".to_string(),
            record_time: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            source: "web_login".to_string(),
            usage_used: None,
            usage_remaining: None,
            usage_total: None,
            usage_percentage: None,
        };

        csv_manager
            .add_account(new_account)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn get_logs(state: State<AppState>) -> Result<Vec<LogEntry>, String> {
    let log_path = state.log_path.lock().unwrap();
    let logger = Logger::new(log_path.clone());

    logger.read_logs().map_err(|e| e.to_string())
}

#[tauri::command]
fn clear_logs(state: State<AppState>) -> Result<(), String> {
    let log_path = state.log_path.lock().unwrap();
    let logger = Logger::new(log_path.clone());

    logger.clear_logs().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_log_file_path(state: State<AppState>) -> Result<String, String> {
    let log_path = state.log_path.lock().unwrap();
    let logger = Logger::new(log_path.clone());

    Ok(logger.get_log_path().to_string_lossy().to_string())
}

#[tauri::command]
fn sync_from_tray(state: State<AppState>) -> Result<String, String> {
    tracing::info!("Syncing current account from tray");
    sync_current_account(state)?;
    Ok("Account synced successfully".to_string())
}

#[tauri::command]
fn refresh_from_tray(state: State<AppState>) -> Result<String, String> {
    tracing::info!("Refreshing all accounts from tray");
    let accounts = batch_update_all_accounts(state)?;
    Ok(format!("Refreshed {} accounts", accounts.len()))
}

#[tauri::command]
fn validate_token(token: String) -> Result<TokenInfo, String> {
    tracing::info!("Validating token");
    token_auth::validate_token_info(&token).map_err(|e| {
        tracing::error!("Token validation failed: {}", e);
        e.to_string()
    })
}

#[tauri::command]
fn import_from_token(state: State<AppState>, token: String) -> Result<Account, String> {
    tracing::info!("Importing account from token");
    let csv_path = state.csv_path.lock().unwrap();
    let csv_manager = CsvManager::new(csv_path.clone());

    let client = token_auth::TokenAuthClient::new();
    let mut account = client.convert_token_to_account(&token).map_err(|e| {
        tracing::error!("Token conversion failed: {}", e);
        e.to_string()
    })?;

    // Set metadata
    account.source = "token_import".to_string();
    account.record_time = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    // Add to CSV
    csv_manager.add_account(account.clone()).map_err(|e| {
        tracing::error!("Failed to add account to CSV: {}", e);
        e.to_string()
    })?;

    tracing::info!(
        "Successfully imported account from token: {}",
        account.email
    );
    Ok(account)
}

#[tauri::command]
fn get_usage_events(state: State<AppState>) -> Result<serde_json::Value, String> {
    tracing::info!("Fetching usage events");

    let cursor_path = state.cursor_base_path.lock().unwrap();
    let base_path = cursor_path.as_ref().ok_or("Cursor path not set")?;

    let db_path = PathDetector::get_db_path(base_path);
    let db = Database::new(db_path);
    let session_token = db.get_session_token().map_err(|e| e.to_string())?;

    let client = DetailedUsageClient::new();
    client.get_usage_events(&session_token).map_err(|e| {
        tracing::error!("Failed to get usage events: {}", e);
        e.to_string()
    })
}

#[tauri::command]
fn get_detailed_user_info(state: State<AppState>) -> Result<DetailedUserInfo, String> {
    tracing::info!("Fetching detailed user info");

    let cursor_path = state.cursor_base_path.lock().unwrap();
    let base_path = cursor_path.as_ref().ok_or("Cursor path not set")?;

    let db_path = PathDetector::get_db_path(base_path);
    let db = Database::new(db_path);
    let session_token = db.get_session_token().map_err(|e| e.to_string())?;

    let client = DetailedUsageClient::new();
    client.get_detailed_user_info(&session_token).map_err(|e| {
        tracing::error!("Failed to get detailed user info: {}", e);
        e.to_string()
    })
}

#[tauri::command]
fn get_invoices(state: State<AppState>) -> Result<serde_json::Value, String> {
    tracing::info!("Fetching invoices");

    let cursor_path = state.cursor_base_path.lock().unwrap();
    let base_path = cursor_path.as_ref().ok_or("Cursor path not set")?;

    let db_path = PathDetector::get_db_path(base_path);
    let db = Database::new(db_path);
    let session_token = db.get_session_token().map_err(|e| e.to_string())?;

    let client = DetailedUsageClient::new();
    client.list_invoices(&session_token).map_err(|e| {
        tracing::error!("Failed to get invoices: {}", e);
        e.to_string()
    })
}

#[tauri::command]
fn get_billing_cycle(state: State<AppState>) -> Result<BillingCycle, String> {
    tracing::info!("Fetching billing cycle");

    let cursor_path = state.cursor_base_path.lock().unwrap();
    let base_path = cursor_path.as_ref().ok_or("Cursor path not set")?;

    let db_path = PathDetector::get_db_path(base_path);
    let db = Database::new(db_path);
    let session_token = db.get_session_token().map_err(|e| e.to_string())?;

    let client = DetailedUsageClient::new();
    client.get_billing_cycle(&session_token).map_err(|e| {
        tracing::error!("Failed to get billing cycle: {}", e);
        e.to_string()
    })
}

fn build_system_tray() -> SystemTray {
    let show = CustomMenuItem::new("show".to_string(), "Show Window");
    let hide = CustomMenuItem::new("hide".to_string(), "Hide Window");
    let sync = CustomMenuItem::new("sync".to_string(), "Sync Current Account");
    let refresh = CustomMenuItem::new("refresh".to_string(), "Refresh All Accounts");
    let quit = CustomMenuItem::new("quit".to_string(), "Quit");

    let tray_menu = SystemTrayMenu::new()
        .add_item(show)
        .add_item(hide)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(sync)
        .add_item(refresh)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(CustomMenuItem::new("accounts_header".to_string(), "Switch Account").disabled())
        .add_item(CustomMenuItem::new("no_accounts".to_string(), "  Loading...").disabled())
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(quit);

    SystemTray::new().with_menu(tray_menu)
}

// Build tray menu with account list and current account
fn build_tray_menu_with_accounts(
    accounts: &[Account],
    current_email: Option<String>,
) -> SystemTrayMenu {
    let show = CustomMenuItem::new("show".to_string(), "Show Window");
    let hide = CustomMenuItem::new("hide".to_string(), "Hide Window");
    let sync = CustomMenuItem::new("sync".to_string(), "Sync Current Account");
    let refresh = CustomMenuItem::new("refresh".to_string(), "Refresh All Accounts");
    let quit = CustomMenuItem::new("quit".to_string(), "Quit");

    let mut tray_menu = SystemTrayMenu::new()
        .add_item(show)
        .add_item(hide)
        .add_native_item(SystemTrayMenuItem::Separator);

    // Add current account display
    if let Some(email) = current_email {
        let current_account_text = format!("Current: {}", email);
        tray_menu = tray_menu.add_item(
            CustomMenuItem::new("current_account".to_string(), current_account_text).disabled(),
        );
    } else {
        tray_menu = tray_menu.add_item(
            CustomMenuItem::new(
                "current_account".to_string(),
                "Current: No account logged in",
            )
            .disabled(),
        );
    }

    tray_menu = tray_menu
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(sync)
        .add_item(refresh)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(CustomMenuItem::new("accounts_header".to_string(), "Switch Account").disabled());

    // Add accounts to menu
    if accounts.is_empty() {
        tray_menu = tray_menu.add_item(
            CustomMenuItem::new("no_accounts".to_string(), "  No accounts available").disabled(),
        );
    } else {
        // Limit to first 10 accounts to avoid overcrowding
        for (idx, account) in accounts.iter().take(10).enumerate() {
            let display_text = format!("  {}", account.email);
            let item_id = format!("account_{}", idx);
            tray_menu = tray_menu.add_item(CustomMenuItem::new(item_id, display_text));
        }

        if accounts.len() > 10 {
            tray_menu = tray_menu.add_item(
                CustomMenuItem::new(
                    "more_accounts".to_string(),
                    format!("  ... and {} more", accounts.len() - 10),
                )
                .disabled(),
            );
        }
    }

    tray_menu = tray_menu
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(quit);

    tray_menu
}

// Update the system tray menu with current accounts
fn update_tray_menu(app: &tauri::AppHandle) {
    let state: State<AppState> = app.state();

    // Get accounts
    let accounts = match get_all_accounts(state.clone()) {
        Ok(accounts) => accounts,
        Err(e) => {
            tracing::error!("Failed to get accounts for tray menu: {}", e);
            Vec::new()
        }
    };

    // Get current account email
    let current_email = {
        let cursor_path = state.cursor_base_path.lock().unwrap();
        if let Some(base_path) = cursor_path.as_ref() {
            let db_path = PathDetector::get_db_path(base_path);
            let db = Database::new(db_path);

            match db.get_auth_info() {
                Ok((email, _)) => Some(email),
                Err(_) => None,
            }
        } else {
            None
        }
    };

    // Build new menu
    let new_menu = build_tray_menu_with_accounts(&accounts, current_email);

    // Update tray
    if let Err(e) = app.tray_handle().set_menu(new_menu) {
        tracing::error!("Failed to update tray menu: {}", e);
    }
}

fn handle_system_tray_event(app: &tauri::AppHandle, event: SystemTrayEvent) {
    match event {
        SystemTrayEvent::LeftClick {
            position: _,
            size: _,
            ..
        } => {
            // Left-click: Toggle window visibility (no menu)
            if let Some(window) = app.get_window("main") {
                if window.is_visible().unwrap_or(false) {
                    let _ = window.hide();
                } else {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
        }
        SystemTrayEvent::RightClick {
            position: _,
            size: _,
            ..
        } => {
            // Right-click: Show menu only (no window popup)
            // The menu will show automatically, nothing to do here
        }
        SystemTrayEvent::MenuItemClick { id, .. } => {
            match id.as_str() {
                "show" => {
                    if let Some(window) = app.get_window("main") {
                        let _ = window.show();
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                    }
                }
                "hide" => {
                    if let Some(window) = app.get_window("main") {
                        let _ = window.hide();
                    }
                }
                "sync" => {
                    // Sync current account
                    let state: State<AppState> = app.state();
                    match sync_current_account(state) {
                        Ok(_) => {
                            tracing::info!("Synced current account from tray");
                            // Notify frontend if window is open
                            if let Some(window) = app.get_window("main") {
                                let _ = window.emit("account-synced", ());
                            }
                        }
                        Err(e) => {
                            tracing::error!("Failed to sync account: {}", e);
                        }
                    }
                }
                "refresh" => {
                    // Refresh all accounts
                    let state: State<AppState> = app.state();
                    match batch_update_all_accounts(state) {
                        Ok(accounts) => {
                            tracing::info!("Refreshed {} accounts from tray", accounts.len());
                            // Update tray menu with refreshed accounts
                            update_tray_menu(app);
                            // Notify frontend if window is open
                            if let Some(window) = app.get_window("main") {
                                let _ = window.emit("accounts-refreshed", ());
                            }
                        }
                        Err(e) => {
                            tracing::error!("Failed to refresh accounts: {}", e);
                        }
                    }
                }
                "quit" => {
                    std::process::exit(0);
                }
                id if id.starts_with("account_") => {
                    // Extract account index from id
                    if let Some(idx_str) = id.strip_prefix("account_") {
                        if let Ok(idx) = idx_str.parse::<usize>() {
                            // Get accounts and switch to the selected one
                            let state: State<AppState> = app.state();
                            match get_all_accounts(state.clone()) {
                                Ok(accounts) => {
                                    if let Some(account) = accounts.get(idx) {
                                        tracing::info!(
                                            "Switching to account from tray: {}",
                                            account.email
                                        );

                                        // Switch account with default reset_machine = false
                                        match switch_account(
                                            state,
                                            account.email.clone(),
                                            account.access_token.clone(),
                                            account.refresh_token.clone(),
                                            false,
                                        ) {
                                            Ok(_) => {
                                                tracing::info!(
                                                    "Successfully switched to account: {}",
                                                    account.email
                                                );
                                                // Update tray menu to show new current account
                                                update_tray_menu(app);
                                                // Notify frontend if window is open
                                                if let Some(window) = app.get_window("main") {
                                                    let _ = window
                                                        .emit("account-switched", &account.email);
                                                }
                                            }
                                            Err(e) => {
                                                tracing::error!("Failed to switch account: {}", e);
                                            }
                                        }
                                    }
                                }
                                Err(e) => {
                                    tracing::error!("Failed to get accounts: {}", e);
                                }
                            }
                        }
                    }
                }
                _ => {}
            }
        }
        _ => {}
    }
}

fn main() {
    tauri::Builder::default()
        .manage(init_app_state())
        .system_tray(build_system_tray())
        .on_system_tray_event(handle_system_tray_event)
        .invoke_handler(tauri::generate_handler![
            get_data_storage_path,
            detect_cursor_path,
            set_cursor_path,
            get_current_account_info,
            get_usage_info,
            get_all_accounts,
            add_account,
            delete_account,
            update_account,
            import_accounts,
            batch_add_accounts,
            switch_account,
            reset_machine_id,
            kill_cursor_process,
            restart_cursor_process,
            update_account_info_from_api,
            batch_update_all_accounts,
            sync_current_account,
            get_logs,
            clear_logs,
            get_log_file_path,
            sync_from_tray,
            refresh_from_tray,
            validate_token,
            import_from_token,
            get_usage_events,
            get_detailed_user_info,
            get_invoices,
            get_billing_cycle,
        ])
        .on_window_event(|event| {
            if let WindowEvent::CloseRequested { api, .. } = event.event() {
                // Prevent window from closing, hide it instead
                event.window().hide().unwrap();
                api.prevent_close();
            }
        })
        .setup(|app| {
            // Initialize CSV path in user data directory
            let state: State<AppState> = app.state();

            // Get app data directory (e.g., ~/Library/Application Support/com.cursor.switcher)
            if let Some(app_data_dir) = app.path_resolver().app_data_dir() {
                // Create directory if it doesn't exist
                if let Err(e) = std::fs::create_dir_all(&app_data_dir) {
                    eprintln!("Failed to create app data directory: {}", e);
                }

                // Initialize logging
                let log_dir = app_data_dir.join("logs");
                match Logger::init(log_dir.clone()) {
                    Ok(guard) => {
                        let mut log_guard = state._log_guard.lock().unwrap();
                        *log_guard = Some(guard);

                        let mut log_path_guard = state.log_path.lock().unwrap();
                        *log_path_guard = log_dir;

                        tracing::info!("Cursor Account Switcher started");
                    }
                    Err(e) => {
                        eprintln!("Failed to initialize logging: {}", e);
                    }
                }

                let csv_path = app_data_dir.join("cursor_auth_total.csv");
                let mut csv_path_guard = state.csv_path.lock().unwrap();
                *csv_path_guard = csv_path.clone();

                tracing::info!("Data will be stored at: {}", csv_path.display());
            } else {
                eprintln!("Failed to get app data directory, using current directory");
            }

            // Auto-detect Cursor path on startup
            if let Ok(path) = PathDetector::detect_cursor_path() {
                let mut cursor_path = state.cursor_base_path.lock().unwrap();
                *cursor_path = Some(path.clone());
                tracing::info!("Cursor path auto-detected: {}", path.display());
            } else {
                tracing::warn!("Failed to auto-detect Cursor path");
            }

            // Initialize tray menu with current accounts
            update_tray_menu(&app.handle());
            tracing::info!("Tray menu initialized with accounts");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
