use crate::types::MachineIds;
use uuid::Uuid;

pub struct MachineIdGenerator;

impl MachineIdGenerator {
    pub fn generate() -> MachineIds {
        let machine_id = Uuid::new_v4().to_string();
        let mac_machine_id = Uuid::new_v4().to_string();
        let dev_device_id = Uuid::new_v4().to_string();
        let sqm_id = format!("{{{}}}", Uuid::new_v4().to_string().to_uppercase());

        MachineIds {
            machine_id,
            mac_machine_id,
            dev_device_id,
            sqm_id,
        }
    }
}

#[cfg(target_os = "windows")]
pub mod windows {
    use anyhow::{Context, Result};
    use uuid::Uuid;
    use winreg::enums::*;
    use winreg::RegKey;

    pub fn update_registry_machine_guid() -> Result<String> {
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        let path = r"SOFTWARE\Microsoft\Cryptography";
        let key = hklm
            .open_subkey_with_flags(path, KEY_ALL_ACCESS)
            .context("Failed to open registry key. Administrator privileges required.")?;

        let new_guid = Uuid::new_v4().to_string();
        key.set_value("MachineGuid", &new_guid)
            .context("Failed to set registry value")?;

        Ok(new_guid)
    }
}
