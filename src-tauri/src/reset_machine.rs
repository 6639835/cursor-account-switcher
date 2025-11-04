use crate::machine_id::MachineIdGenerator;
use crate::path_detector::PathDetector;
use crate::process_utils::ProcessManager;
use anyhow::{Context, Result};
use chrono::Local;
use serde_json::Value;
use std::fs;
use std::path::PathBuf;

pub struct MachineIdResetter {
    base_path: PathBuf,
}

impl MachineIdResetter {
    pub fn new(base_path: PathBuf) -> Self {
        Self { base_path }
    }

    pub fn reset(&self) -> Result<()> {
        // Kill Cursor process first
        ProcessManager::kill_cursor()?;

        // Get storage.json path
        let storage_path = PathDetector::get_storage_path(&self.base_path);

        if !storage_path.exists() {
            anyhow::bail!("storage.json not found at: {:?}", storage_path);
        }

        // Backup storage.json
        self.backup_storage_file(&storage_path)?;

        // Generate new machine IDs
        let new_ids = MachineIdGenerator::generate();

        // Update storage.json
        self.update_storage_file(&storage_path, &new_ids)?;

        // Update main.js file on macOS to replace ioreg command
        #[cfg(target_os = "macos")]
        {
            if let Err(e) = self.update_main_js_file_macos() {
                eprintln!("Warning: Failed to update main.js: {}", e);
                eprintln!("Machine ID reset will continue, but main.js modification failed.");
            }
        }

        // Update main.js file on Windows to replace registry command
        #[cfg(target_os = "windows")]
        {
            if let Err(e) = self.update_main_js_file_windows() {
                eprintln!("Warning: Failed to update main.js: {}", e);
                eprintln!("Machine ID reset will continue, but main.js modification failed.");
            }
        }

        // Update Windows registry if on Windows (no-op on other platforms)
        if let Err(e) = crate::machine_id::update_registry_machine_guid() {
            eprintln!("Warning: Failed to update registry: {}", e);
            eprintln!("Machine ID reset will continue, but may require administrator privileges for full effect.");
        }

        Ok(())
    }

    fn backup_storage_file(&self, storage_path: &PathBuf) -> Result<()> {
        let backup_dir = self.base_path.join("backups");
        fs::create_dir_all(&backup_dir)?;

        let timestamp = Local::now().format("%Y%m%d_%H%M%S");
        let backup_name = format!("storage.json.backup_{}", timestamp);
        let backup_path = backup_dir.join(backup_name);

        fs::copy(storage_path, &backup_path).context("Failed to backup storage.json")?;

        Ok(())
    }

    fn update_storage_file(
        &self,
        storage_path: &PathBuf,
        new_ids: &crate::types::MachineIds,
    ) -> Result<()> {
        // Read current storage.json
        let content = fs::read_to_string(storage_path)?;
        let mut storage: Value = serde_json::from_str(&content)?;

        // Update machine IDs using flat keys (not nested objects)
        // The correct format is "telemetry.machineId" as a key, not storage["telemetry"]["machineId"]
        storage["telemetry.machineId"] = Value::String(new_ids.machine_id.clone());
        storage["telemetry.macMachineId"] = Value::String(new_ids.mac_machine_id.clone());
        storage["telemetry.devDeviceId"] = Value::String(new_ids.dev_device_id.clone());
        storage["telemetry.sqmId"] = Value::String(new_ids.sqm_id.clone());

        // Write back to file
        let updated_content = serde_json::to_string_pretty(&storage)?;
        fs::write(storage_path, updated_content)?;

        Ok(())
    }

    /// Update main.js file on macOS to replace ioreg command with uuidgen
    /// This prevents Cursor from reading hardware-based machine ID
    #[cfg(target_os = "macos")]
    fn update_main_js_file_macos(&self) -> Result<()> {
        let main_js_path =
            PathBuf::from("/Applications/Cursor.app/Contents/Resources/app/out/main.js");

        if !main_js_path.exists() {
            anyhow::bail!("main.js not found at: {:?}", main_js_path);
        }

        // Backup main.js
        let timestamp = Local::now().format("%Y%m%d_%H%M%S");
        let backup_name = format!("main.js.backup_{}", timestamp);
        let backup_path = main_js_path.with_file_name(backup_name);
        fs::copy(&main_js_path, &backup_path).context("Failed to backup main.js")?;

        // Read main.js content
        let content = fs::read_to_string(&main_js_path)?;

        // Replace ioreg command with uuidgen command
        // This matches the working implementation exactly
        // Original: ioreg -rd1 -c IOPlatformExpertDevice
        // Replacement: UUID=$(uuidgen | tr '[:upper:]' '[:lower:]');echo \"IOPlatformUUID = \"$UUID\";
        let old_pattern = "ioreg -rd1 -c IOPlatformExpertDevice";
        let new_pattern =
            r#"UUID=$(uuidgen | tr '[:upper:]' '[:lower:]');echo \"IOPlatformUUID = \"$UUID\";"#;

        let updated_content = content.replace(old_pattern, new_pattern);

        // Write back to file
        fs::write(&main_js_path, updated_content)?;

        // Verify the replacement was successful by checking if the new pattern is in the content
        let verify_content = fs::read_to_string(&main_js_path)?;
        if verify_content.contains(new_pattern) {
            println!("main.js file modified successfully");
        } else {
            eprintln!("Warning: main.js file may not have been correctly modified");
            eprintln!("You can restore from backup: {:?}", backup_path);
        }

        Ok(())
    }

    /// Update main.js file on Windows to replace registry query command with PowerShell
    /// This prevents Cursor from reading hardware-based machine GUID from registry
    #[cfg(target_os = "windows")]
    fn update_main_js_file_windows(&self) -> Result<()> {
        // Get LOCALAPPDATA path
        let local_appdata = std::env::var("LOCALAPPDATA")
            .context("Failed to get LOCALAPPDATA environment variable")?;

        let main_js_path = PathBuf::from(local_appdata)
            .join("Programs")
            .join("cursor")
            .join("resources")
            .join("app")
            .join("out")
            .join("main.js");

        if !main_js_path.exists() {
            anyhow::bail!("main.js not found at: {:?}", main_js_path);
        }

        // Backup main.js
        let timestamp = Local::now().format("%Y%m%d_%H%M%S");
        let backup_name = format!("main.js.backup_{}", timestamp);
        let backup_path = main_js_path.with_file_name(backup_name);
        fs::copy(&main_js_path, &backup_path).context("Failed to backup main.js")?;

        // Read main.js content
        let content = fs::read_to_string(&main_js_path)?;

        // Replace registry query command with PowerShell command
        // This matches the working implementation exactly
        // Note: The variable name (e.g., v5[s$()], u5[bM()]) may vary between Cursor versions
        // We'll try multiple patterns to handle different versions
        let patterns_to_try = vec![
            r#"${v5[s$()]}\\REG.exe QUERY HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid"#,
            r#"${u5[bM()]}\\REG.exe QUERY HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid"#,
        ];
        let new_pattern = r#"powershell -Command "[guid]::NewGuid().ToString().ToLower()""#;

        let mut updated_content = content.clone();
        let mut replaced = false;
        for old_pattern in patterns_to_try {
            if updated_content.contains(old_pattern) {
                updated_content = updated_content.replace(old_pattern, new_pattern);
                replaced = true;
                break;
            }
        }

        // Write back to file
        fs::write(&main_js_path, updated_content)?;

        // Verify the replacement was successful by checking if the new pattern is in the content
        let verify_content = fs::read_to_string(&main_js_path)?;
        if verify_content.contains(new_pattern) {
            println!("main.js file modified successfully");
        } else if !replaced {
            eprintln!("Warning: Original REG.exe pattern not found in main.js");
            eprintln!("This might indicate a new Cursor version with a different pattern");
            eprintln!("You can restore from backup: {:?}", backup_path);
        } else {
            eprintln!("Warning: main.js file may not have been correctly modified");
            eprintln!("You can restore from backup: {:?}", backup_path);
        }

        Ok(())
    }
}
