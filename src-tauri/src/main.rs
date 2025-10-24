// Prevents additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod api_client;
mod csv_manager;
mod database;
mod machine_id;
mod path_detector;
mod process_utils;
mod reset_machine;
mod types;

use api_client::CursorApiClient;
use csv_manager::CsvManager;
use database::Database;
use path_detector::PathDetector;
use process_utils::ProcessManager;
use reset_machine::MachineIdResetter;
use types::*;

use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Manager, State};

// Global state
struct AppState {
    csv_path: Mutex<PathBuf>,
    cursor_base_path: Mutex<Option<PathBuf>>,
}

// Initialize app state with placeholder
fn init_app_state() -> AppState {
    // Placeholder - will be set properly in setup()
    AppState {
        csv_path: Mutex::new(PathBuf::from(".")),
        cursor_base_path: Mutex::new(None),
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
    let cursor_path = state.cursor_base_path.lock().unwrap();
    let base_path = cursor_path.as_ref().ok_or("Cursor path not set")?;

    let db_path = PathDetector::get_db_path(base_path);
    let db = Database::new(db_path);

    let (email, access_token) = db.get_auth_info().map_err(|e| e.to_string())?;

    let api_client = CursorApiClient::new();
    api_client
        .get_account_info(&email, &access_token)
        .map_err(|e| e.to_string())
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
    let csv_path = state.csv_path.lock().unwrap();
    let csv_manager = CsvManager::new(csv_path.clone());

    csv_manager
        .parse_import_text(&text)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn batch_add_accounts(state: State<AppState>, accounts: Vec<Account>) -> Result<(), String> {
    let csv_path = state.csv_path.lock().unwrap();
    let csv_manager = CsvManager::new(csv_path.clone());

    for account in accounts {
        csv_manager
            .add_account(account)
            .map_err(|e| e.to_string())?;
    }

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
    let cursor_path = state.cursor_base_path.lock().unwrap();
    let base_path = cursor_path.as_ref().ok_or("Cursor path not set")?.clone();

    // Kill Cursor process
    ProcessManager::kill_cursor().map_err(|e| e.to_string())?;

    // Update database
    let db_path = PathDetector::get_db_path(&base_path);
    let db = Database::new(db_path);

    db.update_auth(&email, &access_token, Some(&refresh_token))
        .map_err(|e| e.to_string())?;

    // Reset machine ID if requested
    if reset_machine {
        let resetter = MachineIdResetter::new(base_path.clone());
        resetter
            .reset()
            .map_err(|e| format!("Machine ID reset failed: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
fn reset_machine_id(state: State<AppState>) -> Result<(), String> {
    let cursor_path = state.cursor_base_path.lock().unwrap();
    let base_path = cursor_path.as_ref().ok_or("Cursor path not set")?.clone();

    let resetter = MachineIdResetter::new(base_path);
    resetter.reset().map_err(|e| e.to_string())
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
    let csv_path = state.csv_path.lock().unwrap();
    let csv_manager = CsvManager::new(csv_path.clone());

    let mut accounts = csv_manager.read_accounts().map_err(|e| e.to_string())?;

    let api_client = CursorApiClient::new();

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
                    Err(_) => {
                        // If usage info fails, set to None
                        account.usage_used = None;
                        account.usage_remaining = None;
                        account.usage_total = None;
                        account.usage_percentage = None;
                    }
                }
            }
            Err(_e) => {
                // Mark account as error but continue
                account.status = "error".to_string();
            }
        }
    }

    csv_manager
        .write_accounts(&accounts)
        .map_err(|e| e.to_string())?;

    Ok(accounts)
}

fn main() {
    tauri::Builder::default()
        .manage(init_app_state())
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
        ])
        .setup(|app| {
            // Initialize CSV path in user data directory
            let state: State<AppState> = app.state();

            // Get app data directory (e.g., ~/Library/Application Support/com.cursor.switcher)
            if let Some(app_data_dir) = app.path_resolver().app_data_dir() {
                // Create directory if it doesn't exist
                if let Err(e) = std::fs::create_dir_all(&app_data_dir) {
                    eprintln!("Failed to create app data directory: {}", e);
                }

                let csv_path = app_data_dir.join("cursor_auth_total.csv");
                let mut csv_path_guard = state.csv_path.lock().unwrap();
                *csv_path_guard = csv_path.clone();

                println!("Data will be stored at: {}", csv_path.display());
            } else {
                eprintln!("Failed to get app data directory, using current directory");
            }

            // Auto-detect Cursor path on startup
            if let Ok(path) = PathDetector::detect_cursor_path() {
                let mut cursor_path = state.cursor_base_path.lock().unwrap();
                *cursor_path = Some(path);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
