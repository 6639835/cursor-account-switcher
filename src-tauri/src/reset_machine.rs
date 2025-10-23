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

        // Update Windows registry if on Windows
        #[cfg(target_os = "windows")]
        {
            if let Err(e) = crate::machine_id::windows::update_registry_machine_guid() {
                eprintln!("Warning: Failed to update registry: {}", e);
                eprintln!("Machine ID reset will continue, but may require administrator privileges for full effect.");
            }
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

        // Ensure telemetry section exists
        if storage.get("telemetry").is_none() {
            storage["telemetry"] = serde_json::json!({});
        }

        // Update machine IDs
        storage["telemetry"]["machineId"] = Value::String(new_ids.machine_id.clone());
        storage["telemetry"]["macMachineId"] = Value::String(new_ids.mac_machine_id.clone());
        storage["telemetry"]["devDeviceId"] = Value::String(new_ids.dev_device_id.clone());
        storage["telemetry"]["sqmId"] = Value::String(new_ids.sqm_id.clone());

        // Write back to file
        let updated_content = serde_json::to_string_pretty(&storage)?;
        fs::write(storage_path, updated_content)?;

        Ok(())
    }
}
