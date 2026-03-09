//! HugLink — Cross-device encrypted model sharing (Phase 8)
//!
//! Allows users to run models on a remote GPU machine and access them
//! transparently from any device via WireGuard/Tailscale tunnels.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::State;
use tokio::sync::Mutex;
use std::sync::Arc;

/// A discovered or configured remote device.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HugLinkDevice {
    pub id: String,
    pub name: String,
    pub address: String,
    pub is_online: bool,
    pub last_seen: String,
    pub hardware: DeviceHardware,
    pub loaded_models: Vec<String>,
    pub latency_ms: u64,
    pub is_preferred: bool,
}

/// Hardware information for a remote device.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceHardware {
    pub gpu: String,
    pub vram_mb: u64,
    pub ram_mb: u64,
}

/// HugLink service state.
pub struct HugLinkHost {
    pub enabled: bool,
    pub device_name: String,
    pub devices: HashMap<String, HugLinkDevice>,
}

pub type ManagedHugLinkHost = Arc<Mutex<HugLinkHost>>;

impl HugLinkHost {
    pub fn new() -> Self {
        let hostname = hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "HugBrowse-Device".to_string());
        Self {
            enabled: false,
            device_name: hostname,
            devices: HashMap::new(),
        }
    }
}

// ── Tauri Commands ──────────────────────────────────────────────────

/// Enable or disable the HugLink service.
#[tauri::command]
pub async fn huglink_set_enabled(
    state: State<'_, ManagedHugLinkHost>,
    enabled: bool,
) -> Result<(), String> {
    let mut host = state.lock().await;
    host.enabled = enabled;
    Ok(())
}

/// Check if HugLink is enabled.
#[tauri::command]
pub async fn huglink_is_enabled(
    state: State<'_, ManagedHugLinkHost>,
) -> Result<bool, String> {
    let host = state.lock().await;
    Ok(host.enabled)
}

/// List all known devices.
#[tauri::command]
pub async fn huglink_list_devices(
    state: State<'_, ManagedHugLinkHost>,
) -> Result<Vec<HugLinkDevice>, String> {
    let host = state.lock().await;
    Ok(host.devices.values().cloned().collect())
}

/// Set a device as the preferred inference target.
#[tauri::command]
pub async fn huglink_set_preferred(
    state: State<'_, ManagedHugLinkHost>,
    device_id: String,
) -> Result<(), String> {
    let mut host = state.lock().await;
    for dev in host.devices.values_mut() {
        dev.is_preferred = dev.id == device_id;
    }
    Ok(())
}

/// Rename this device.
#[tauri::command]
pub async fn huglink_rename(
    state: State<'_, ManagedHugLinkHost>,
    new_name: String,
) -> Result<(), String> {
    let mut host = state.lock().await;
    host.device_name = new_name;
    Ok(())
}

/// Get the status summary of HugLink.
#[tauri::command]
pub async fn huglink_status(
    state: State<'_, ManagedHugLinkHost>,
) -> Result<serde_json::Value, String> {
    let host = state.lock().await;
    Ok(serde_json::json!({
        "enabled": host.enabled,
        "deviceName": host.device_name,
        "connectedDevices": host.devices.len(),
        "preferredDevice": host.devices.values().find(|d| d.is_preferred).map(|d| d.name.clone()),
    }))
}
