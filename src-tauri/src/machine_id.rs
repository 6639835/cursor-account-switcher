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

/// Update registry machine GUID (Windows only)
/// On non-Windows platforms, this is a no-op that returns Ok(())
#[cfg(target_os = "windows")]
pub fn update_registry_machine_guid() -> anyhow::Result<()> {
    use anyhow::Context;
    use winreg::enums::*;
    use winreg::RegKey;

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let path = r"SOFTWARE\Microsoft\Cryptography";
    let key = hklm
        .open_subkey_with_flags(path, KEY_ALL_ACCESS)
        .context("Failed to open registry key. Administrator privileges required.")?;

    let new_guid = Uuid::new_v4().to_string();
    key.set_value("MachineGuid", &new_guid)
        .context("Failed to set registry value")?;

    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn update_registry_machine_guid() -> anyhow::Result<()> {
    // No-op on non-Windows platforms
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_machine_ids() {
        let ids = MachineIdGenerator::generate();

        // Validate that all IDs are non-empty
        assert!(!ids.machine_id.is_empty());
        assert!(!ids.mac_machine_id.is_empty());
        assert!(!ids.dev_device_id.is_empty());
        assert!(!ids.sqm_id.is_empty());

        // Validate UUID format (basic check)
        assert!(ids.machine_id.contains('-'));
        assert!(ids.mac_machine_id.contains('-'));
        assert!(ids.dev_device_id.contains('-'));

        // Validate sqm_id has braces and is uppercase
        assert!(ids.sqm_id.starts_with('{'));
        assert!(ids.sqm_id.ends_with('}'));
        assert_eq!(ids.sqm_id, ids.sqm_id.to_uppercase());
    }

    #[test]
    fn test_generate_unique_ids() {
        let ids1 = MachineIdGenerator::generate();
        let ids2 = MachineIdGenerator::generate();

        // Each generation should produce unique IDs
        assert_ne!(ids1.machine_id, ids2.machine_id);
        assert_ne!(ids1.mac_machine_id, ids2.mac_machine_id);
        assert_ne!(ids1.dev_device_id, ids2.dev_device_id);
        assert_ne!(ids1.sqm_id, ids2.sqm_id);
    }

    #[test]
    fn test_machine_ids_serialization() {
        let ids = MachineIdGenerator::generate();

        // Test that the struct can be serialized
        let json = serde_json::to_string(&ids);
        assert!(json.is_ok());

        // Test that we can deserialize it back
        let deserialized: Result<MachineIds, _> = serde_json::from_str(&json.unwrap());
        assert!(deserialized.is_ok());
    }
}
