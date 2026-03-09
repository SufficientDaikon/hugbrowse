//! Plugin System — Phase 8 of HugBrowse v1.0
//!
//! Manages TypeScript/JavaScript plugins with sandboxed execution.
//! Supports tool, preprocessor, generator, and UI extension plugins.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::State;
use tokio::sync::Mutex;
use std::sync::Arc;

/// Plugin type discriminator.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PluginType {
    Tool,
    Preprocessor,
    Generator,
    Ui,
}

/// Plugin lifecycle status.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PluginStatus {
    Installed,
    Enabled,
    Disabled,
    Error,
}

/// Plugin manifest (parsed from plugin.json in each plugin directory).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginManifest {
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    #[serde(rename = "type")]
    pub plugin_type: PluginType,
    pub permissions: Vec<String>,
    pub entry: String,
    pub config_schema: Option<serde_json::Value>,
}

/// A registered plugin with runtime state.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Plugin {
    pub id: String,
    pub manifest: PluginManifest,
    pub status: PluginStatus,
    pub install_path: String,
    pub config: HashMap<String, serde_json::Value>,
    pub error: Option<String>,
}

/// Plugin host managing all installed plugins.
pub struct PluginHost {
    pub plugins: HashMap<String, Plugin>,
    pub plugins_dir: PathBuf,
}

pub type ManagedPluginHost = Arc<Mutex<PluginHost>>;

impl PluginHost {
    pub fn new(plugins_dir: PathBuf) -> Self {
        Self {
            plugins: HashMap::new(),
            plugins_dir,
        }
    }

    /// Scan the plugins directory for installed plugins.
    pub fn scan_plugins(&mut self) -> Result<(), String> {
        if !self.plugins_dir.exists() {
            let _ = std::fs::create_dir_all(&self.plugins_dir);
            return Ok(());
        }

        let entries = std::fs::read_dir(&self.plugins_dir)
            .map_err(|e| format!("Cannot read plugins dir: {e}"))?;

        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let manifest_path = path.join("plugin.json");
            if !manifest_path.exists() {
                continue;
            }

            match std::fs::read_to_string(&manifest_path) {
                Ok(contents) => {
                    match serde_json::from_str::<PluginManifest>(&contents) {
                        Ok(manifest) => {
                            let id = manifest.name.clone();
                            let plugin = Plugin {
                                id: id.clone(),
                                manifest,
                                status: PluginStatus::Installed,
                                install_path: path.to_string_lossy().to_string(),
                                config: HashMap::new(),
                                error: None,
                            };
                            self.plugins.insert(id, plugin);
                        }
                        Err(e) => {
                            eprintln!("Invalid plugin manifest at {:?}: {}", manifest_path, e);
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Cannot read {:?}: {}", manifest_path, e);
                }
            }
        }
        Ok(())
    }
}

// ── Tauri Commands ──────────────────────────────────────────────────

/// List all installed plugins.
#[tauri::command]
pub async fn plugin_list(
    state: State<'_, ManagedPluginHost>,
) -> Result<Vec<Plugin>, String> {
    let host = state.lock().await;
    Ok(host.plugins.values().cloned().collect())
}

/// Enable a plugin by ID.
#[tauri::command]
pub async fn plugin_enable(
    state: State<'_, ManagedPluginHost>,
    plugin_id: String,
) -> Result<(), String> {
    let mut host = state.lock().await;
    let plugin = host.plugins.get_mut(&plugin_id)
        .ok_or_else(|| format!("Plugin '{plugin_id}' not found"))?;
    plugin.status = PluginStatus::Enabled;
    Ok(())
}

/// Disable a plugin by ID.
#[tauri::command]
pub async fn plugin_disable(
    state: State<'_, ManagedPluginHost>,
    plugin_id: String,
) -> Result<(), String> {
    let mut host = state.lock().await;
    let plugin = host.plugins.get_mut(&plugin_id)
        .ok_or_else(|| format!("Plugin '{plugin_id}' not found"))?;
    plugin.status = PluginStatus::Disabled;
    Ok(())
}

/// Uninstall a plugin by ID (removes from disk).
#[tauri::command]
pub async fn plugin_uninstall(
    state: State<'_, ManagedPluginHost>,
    plugin_id: String,
) -> Result<(), String> {
    let mut host = state.lock().await;
    let plugin = host.plugins.remove(&plugin_id)
        .ok_or_else(|| format!("Plugin '{plugin_id}' not found"))?;
    let path = PathBuf::from(&plugin.install_path);
    if path.exists() {
        std::fs::remove_dir_all(&path)
            .map_err(|e| format!("Failed to remove plugin directory: {e}"))?;
    }
    Ok(())
}

/// Rescan plugins directory for new plugins.
#[tauri::command]
pub async fn plugin_rescan(
    state: State<'_, ManagedPluginHost>,
) -> Result<usize, String> {
    let mut host = state.lock().await;
    host.scan_plugins()?;
    Ok(host.plugins.len())
}

/// Get a single plugin by ID.
#[tauri::command]
pub async fn plugin_get(
    state: State<'_, ManagedPluginHost>,
    plugin_id: String,
) -> Result<Plugin, String> {
    let host = state.lock().await;
    host.plugins.get(&plugin_id)
        .cloned()
        .ok_or_else(|| format!("Plugin '{plugin_id}' not found"))
}

/// Update plugin configuration.
#[tauri::command]
pub async fn plugin_set_config(
    state: State<'_, ManagedPluginHost>,
    plugin_id: String,
    config: HashMap<String, serde_json::Value>,
) -> Result<(), String> {
    let mut host = state.lock().await;
    let plugin = host.plugins.get_mut(&plugin_id)
        .ok_or_else(|| format!("Plugin '{plugin_id}' not found"))?;
    plugin.config = config;
    Ok(())
}
