use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;

pub type ManagedConfigManager = Arc<tokio::sync::Mutex<ConfigManager>>;

// ─── AppSettings (Omega Spec §10.2) ─────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub general: GeneralSettings,
    pub models: ModelSettings,
    pub server: ServerSettings,
    pub appearance: AppearanceSettings,
    pub downloads: DownloadSettings,
    pub advanced: AdvancedSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneralSettings {
    pub language: String,
    pub auto_update: bool,
    pub telemetry: bool,
    pub start_minimized: bool,
    pub close_to_tray: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelSettings {
    pub default_gpu: GpuSetting,
    pub default_context_length: u32,
    pub default_ttl_seconds: u64,
    pub auto_evict: bool,
    pub jit_loading: bool,
    pub models_directory: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum GpuSetting {
    Layers(i32),
    Max(String),
}

impl Default for GpuSetting {
    fn default() -> Self {
        GpuSetting::Max("max".to_string())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerSettings {
    pub port: u16,
    pub host: String,
    pub cors_origins: Vec<String>,
    pub auto_start: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppearanceSettings {
    pub theme: String,
    pub font_size: u32,
    pub font_family: String,
    pub sidebar_width: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadSettings {
    pub max_concurrent: u32,
    pub bandwidth_limit_kbps: u32,
    pub auto_resume: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvancedSettings {
    pub log_level: String,
    pub experimental_features: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            general: GeneralSettings {
                language: "en".to_string(),
                auto_update: true,
                telemetry: false,
                start_minimized: false,
                close_to_tray: true,
            },
            models: ModelSettings {
                default_gpu: GpuSetting::default(),
                default_context_length: 4096,
                default_ttl_seconds: 3600,
                auto_evict: true,
                jit_loading: true,
                models_directory: String::new(), // resolved at runtime
            },
            server: ServerSettings {
                port: 8080,
                host: "127.0.0.1".to_string(),
                cors_origins: vec!["*".to_string()],
                auto_start: false,
            },
            appearance: AppearanceSettings {
                theme: "auto".to_string(),
                font_size: 14,
                font_family: "system".to_string(),
                sidebar_width: 280,
            },
            downloads: DownloadSettings {
                max_concurrent: 2,
                bandwidth_limit_kbps: 0,
                auto_resume: true,
            },
            advanced: AdvancedSettings {
                log_level: "info".to_string(),
                experimental_features: false,
            },
        }
    }
}

// ─── Model YAML (Omega Spec §10.1) ─────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelYaml {
    pub model: String,
    #[serde(default = "default_version")]
    pub version: u32,
    #[serde(default)]
    pub metadata: ModelMetadata,
    #[serde(default)]
    pub config: ModelConfig,
    #[serde(default)]
    pub custom_fields: HashMap<String, CustomField>,
}

fn default_version() -> u32 { 1 }

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ModelMetadata {
    #[serde(default)]
    pub architecture: String,
    #[serde(default)]
    pub parameter_count: String,
    #[serde(default)]
    pub context_length: u64,
    #[serde(default)]
    pub has_vision: bool,
    #[serde(default)]
    pub has_reasoning: bool,
    #[serde(default)]
    pub domain: String,
    #[serde(default)]
    pub license: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ModelConfig {
    #[serde(default)]
    pub load: LoadConfig,
    #[serde(default)]
    pub inference: InferenceConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadConfig {
    pub context_length: u32,
    pub gpu: GpuSetting,
}

impl Default for LoadConfig {
    fn default() -> Self {
        Self {
            context_length: 8192,
            gpu: GpuSetting::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InferenceConfig {
    pub temperature: f64,
    pub top_p: f64,
    pub top_k: u32,
    pub max_tokens: u32,
    pub repeat_penalty: f64,
    #[serde(default)]
    pub system_prompt: String,
}

impl Default for InferenceConfig {
    fn default() -> Self {
        Self {
            temperature: 0.7,
            top_p: 0.9,
            top_k: 40,
            max_tokens: 2048,
            repeat_penalty: 1.1,
            system_prompt: "You are a helpful assistant.".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomField {
    #[serde(rename = "type")]
    pub field_type: String,
    pub label: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub default: serde_json::Value,
}

// ─── Presets (Omega Spec §6.3) ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Preset {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub system_prompt: String,
    pub parameters: InferenceParameters,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InferenceParameters {
    pub temperature: f64,
    pub top_p: f64,
    pub top_k: u32,
    pub max_tokens: u32,
    pub repeat_penalty: f64,
    #[serde(default)]
    pub stop: Vec<String>,
    pub seed: Option<i64>,
}

impl Default for InferenceParameters {
    fn default() -> Self {
        Self {
            temperature: 0.7,
            top_p: 0.9,
            top_k: 40,
            max_tokens: 2048,
            repeat_penalty: 1.1,
            stop: Vec::new(),
            seed: None,
        }
    }
}

// ─── Per-Model Settings (Omega Spec §10.3) ──────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PerModelSettings {
    pub load: Option<LoadConfig>,
    pub inference: Option<InferenceConfig>,
}

// ─── ConfigManager ──────────────────────────────────────────────────────

pub struct ConfigManager {
    pub settings: AppSettings,
    pub presets: Vec<Preset>,
    pub per_model_settings: HashMap<String, PerModelSettings>,
    config_dir: PathBuf,
}

impl ConfigManager {
    pub fn new() -> Self {
        Self {
            settings: AppSettings::default(),
            presets: Vec::new(),
            per_model_settings: HashMap::new(),
            config_dir: PathBuf::new(),
        }
    }

    pub fn init(&mut self, app_data_dir: PathBuf) {
        self.config_dir = app_data_dir.join("config");
        std::fs::create_dir_all(&self.config_dir).ok();
        std::fs::create_dir_all(self.config_dir.join("presets")).ok();
        std::fs::create_dir_all(self.config_dir.join("per-model")).ok();

        // Resolve default models directory
        if self.settings.models.models_directory.is_empty() {
            let home = get_home_dir();
            self.settings.models.models_directory = format!("{}/.hugbrowse/models", home);
        }

        self.load_settings();
        self.load_presets();
        self.load_per_model_settings();
    }

    // ─── Settings persistence ───────────────────────────────────────

    fn settings_path(&self) -> PathBuf {
        self.config_dir.join("settings.json")
    }

    fn load_settings(&mut self) {
        let path = self.settings_path();
        if path.exists() {
            if let Ok(data) = std::fs::read_to_string(&path) {
                if let Ok(loaded) = serde_json::from_str::<AppSettings>(&data) {
                    self.settings = loaded;
                }
            }
        }
        // Ensure models directory is resolved
        if self.settings.models.models_directory.is_empty() {
            let home = get_home_dir();
            self.settings.models.models_directory = format!("{}/.hugbrowse/models", home);
        }
    }

    fn save_settings(&self) -> Result<(), String> {
        let path = self.settings_path();
        let json = serde_json::to_string_pretty(&self.settings)
            .map_err(|e| format!("Serialize error: {}", e))?;
        std::fs::write(&path, json)
            .map_err(|e| format!("Write error: {}", e))?;
        Ok(())
    }

    pub fn update_settings(&mut self, settings: AppSettings) -> Result<(), String> {
        self.settings = settings;
        self.save_settings()
    }

    // ─── Presets persistence ────────────────────────────────────────

    fn presets_dir(&self) -> PathBuf {
        self.config_dir.join("presets")
    }

    fn load_presets(&mut self) {
        let dir = self.presets_dir();
        self.presets.clear();
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) == Some("json") {
                    if let Ok(data) = std::fs::read_to_string(&path) {
                        if let Ok(preset) = serde_json::from_str::<Preset>(&data) {
                            self.presets.push(preset);
                        }
                    }
                }
            }
        }
        self.presets.sort_by(|a, b| a.name.cmp(&b.name));
    }

    pub fn create_preset(&mut self, name: String, description: String, system_prompt: String, parameters: InferenceParameters) -> Result<Preset, String> {
        let now = chrono::Utc::now().to_rfc3339();
        let id = format!("preset_{}", uuid::Uuid::new_v4().to_string().replace("-", "")[..12].to_string());
        let preset = Preset {
            id: id.clone(),
            name,
            description,
            system_prompt,
            parameters,
            created_at: now.clone(),
            updated_at: now,
            is_default: false,
        };
        self.save_preset_file(&preset)?;
        self.presets.push(preset.clone());
        self.presets.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(preset)
    }

    pub fn update_preset(&mut self, id: String, name: Option<String>, description: Option<String>, system_prompt: Option<String>, parameters: Option<InferenceParameters>, is_default: Option<bool>) -> Result<Preset, String> {
        let preset = self.presets.iter_mut().find(|p| p.id == id)
            .ok_or_else(|| format!("Preset not found: {}", id))?;

        if let Some(n) = name { preset.name = n; }
        if let Some(d) = description { preset.description = d; }
        if let Some(sp) = system_prompt { preset.system_prompt = sp; }
        if let Some(p) = parameters { preset.parameters = p; }
        if let Some(def) = is_default { preset.is_default = def; }
        preset.updated_at = chrono::Utc::now().to_rfc3339();

        let updated = preset.clone();
        self.save_preset_file(&updated)?;
        Ok(updated)
    }

    pub fn delete_preset(&mut self, id: &str) -> Result<(), String> {
        let path = self.presets_dir().join(format!("{}.json", id));
        if path.exists() {
            std::fs::remove_file(&path)
                .map_err(|e| format!("Delete error: {}", e))?;
        }
        self.presets.retain(|p| p.id != id);
        Ok(())
    }

    fn save_preset_file(&self, preset: &Preset) -> Result<(), String> {
        let path = self.presets_dir().join(format!("{}.json", preset.id));
        let json = serde_json::to_string_pretty(preset)
            .map_err(|e| format!("Serialize error: {}", e))?;
        std::fs::write(&path, json)
            .map_err(|e| format!("Write error: {}", e))?;
        Ok(())
    }

    // ─── Per-model settings persistence ─────────────────────────────

    fn per_model_dir(&self) -> PathBuf {
        self.config_dir.join("per-model")
    }

    fn load_per_model_settings(&mut self) {
        let dir = self.per_model_dir();
        self.per_model_settings.clear();
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) == Some("json") {
                    if let Ok(data) = std::fs::read_to_string(&path) {
                        if let Ok(settings) = serde_json::from_str::<PerModelSettings>(&data) {
                            let model_id = path.file_stem()
                                .and_then(|s| s.to_str())
                                .unwrap_or("")
                                .to_string();
                            self.per_model_settings.insert(model_id, settings);
                        }
                    }
                }
            }
        }
    }

    pub fn set_per_model_settings(&mut self, model_id: String, settings: PerModelSettings) -> Result<(), String> {
        let path = self.per_model_dir().join(format!("{}.json", sanitize_filename(&model_id)));
        let json = serde_json::to_string_pretty(&settings)
            .map_err(|e| format!("Serialize error: {}", e))?;
        std::fs::write(&path, json)
            .map_err(|e| format!("Write error: {}", e))?;
        self.per_model_settings.insert(model_id, settings);
        Ok(())
    }

    pub fn get_per_model_settings(&self, model_id: &str) -> Option<&PerModelSettings> {
        self.per_model_settings.get(model_id)
    }

    // ─── model.yaml operations ──────────────────────────────────────

    pub fn parse_model_yaml(path: &str) -> Result<ModelYaml, String> {
        let data = std::fs::read_to_string(path)
            .map_err(|e| format!("Read error: {}", e))?;
        serde_yaml::from_str::<ModelYaml>(&data)
            .map_err(|e| format!("YAML parse error: {}", e))
    }

    pub fn save_model_yaml(path: &str, yaml: &ModelYaml) -> Result<(), String> {
        let data = serde_yaml::to_string(yaml)
            .map_err(|e| format!("YAML serialize error: {}", e))?;
        std::fs::write(path, data)
            .map_err(|e| format!("Write error: {}", e))?;
        Ok(())
    }

    pub fn generate_model_yaml(model_id: &str, _file_path: &str) -> ModelYaml {
        ModelYaml {
            model: model_id.to_string(),
            version: 1,
            metadata: ModelMetadata {
                architecture: String::new(),
                parameter_count: String::new(),
                context_length: 0,
                has_vision: false,
                has_reasoning: false,
                domain: "general".to_string(),
                license: String::new(),
            },
            config: ModelConfig::default(),
            custom_fields: HashMap::new(),
        }
    }

    // ─── Settings merge (Omega Spec §10.3) ──────────────────────────
    // Priority: per-model > model.yaml > preset > global defaults

    pub fn resolve_inference_config(&self, model_id: &str, model_yaml: Option<&ModelYaml>, preset_id: Option<&str>) -> InferenceConfig {
        // Start with global defaults
        let mut config = InferenceConfig::default();

        // Apply preset if provided
        if let Some(pid) = preset_id {
            if let Some(preset) = self.presets.iter().find(|p| p.id == pid) {
                config.temperature = preset.parameters.temperature;
                config.top_p = preset.parameters.top_p;
                config.top_k = preset.parameters.top_k;
                config.max_tokens = preset.parameters.max_tokens;
                config.repeat_penalty = preset.parameters.repeat_penalty;
                if !preset.system_prompt.is_empty() {
                    config.system_prompt = preset.system_prompt.clone();
                }
            }
        }

        // Apply model.yaml if provided
        if let Some(yaml) = model_yaml {
            let inf = &yaml.config.inference;
            config.temperature = inf.temperature;
            config.top_p = inf.top_p;
            config.top_k = inf.top_k;
            config.max_tokens = inf.max_tokens;
            config.repeat_penalty = inf.repeat_penalty;
            if !inf.system_prompt.is_empty() {
                config.system_prompt = inf.system_prompt.clone();
            }
        }

        // Apply per-model overrides if present
        if let Some(pms) = self.per_model_settings.get(model_id) {
            if let Some(ref inf) = pms.inference {
                config.temperature = inf.temperature;
                config.top_p = inf.top_p;
                config.top_k = inf.top_k;
                config.max_tokens = inf.max_tokens;
                config.repeat_penalty = inf.repeat_penalty;
                if !inf.system_prompt.is_empty() {
                    config.system_prompt = inf.system_prompt.clone();
                }
            }
        }

        config
    }
}

// ─── Helpers ────────────────────────────────────────────────────────────

fn get_home_dir() -> String {
    #[cfg(target_os = "windows")]
    {
        std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\Default".to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::env::var("HOME").unwrap_or_else(|_| "/home".to_string())
    }
}

fn sanitize_filename(name: &str) -> String {
    name.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_")
}

// ─── Tauri Commands ─────────────────────────────────────────────────────

#[tauri::command]
pub async fn config_get_settings(
    state: State<'_, ManagedConfigManager>,
) -> Result<AppSettings, String> {
    let mgr = state.lock().await;
    Ok(mgr.settings.clone())
}

#[tauri::command]
pub async fn config_update_settings(
    state: State<'_, ManagedConfigManager>,
    settings: AppSettings,
) -> Result<(), String> {
    let mut mgr = state.lock().await;
    mgr.update_settings(settings)
}

#[tauri::command]
pub async fn config_list_presets(
    state: State<'_, ManagedConfigManager>,
) -> Result<Vec<Preset>, String> {
    let mgr = state.lock().await;
    Ok(mgr.presets.clone())
}

#[tauri::command]
pub async fn config_create_preset(
    state: State<'_, ManagedConfigManager>,
    name: String,
    description: String,
    system_prompt: String,
    parameters: InferenceParameters,
) -> Result<Preset, String> {
    let mut mgr = state.lock().await;
    mgr.create_preset(name, description, system_prompt, parameters)
}

#[tauri::command]
pub async fn config_update_preset(
    state: State<'_, ManagedConfigManager>,
    id: String,
    name: Option<String>,
    description: Option<String>,
    system_prompt: Option<String>,
    parameters: Option<InferenceParameters>,
    is_default: Option<bool>,
) -> Result<Preset, String> {
    let mut mgr = state.lock().await;
    mgr.update_preset(id, name, description, system_prompt, parameters, is_default)
}

#[tauri::command]
pub async fn config_delete_preset(
    state: State<'_, ManagedConfigManager>,
    id: String,
) -> Result<(), String> {
    let mut mgr = state.lock().await;
    mgr.delete_preset(&id)
}

#[tauri::command]
pub async fn config_get_per_model(
    state: State<'_, ManagedConfigManager>,
    model_id: String,
) -> Result<Option<PerModelSettings>, String> {
    let mgr = state.lock().await;
    Ok(mgr.get_per_model_settings(&model_id).cloned())
}

#[tauri::command]
pub async fn config_set_per_model(
    state: State<'_, ManagedConfigManager>,
    model_id: String,
    settings: PerModelSettings,
) -> Result<(), String> {
    let mut mgr = state.lock().await;
    mgr.set_per_model_settings(model_id, settings)
}

#[tauri::command]
pub async fn config_parse_model_yaml(
    path: String,
) -> Result<ModelYaml, String> {
    ConfigManager::parse_model_yaml(&path)
}

#[tauri::command]
pub async fn config_save_model_yaml(
    path: String,
    yaml: ModelYaml,
) -> Result<(), String> {
    ConfigManager::save_model_yaml(&path, &yaml)
}

#[tauri::command]
pub async fn config_export_settings(
    state: State<'_, ManagedConfigManager>,
) -> Result<String, String> {
    let mgr = state.lock().await;
    serde_json::to_string_pretty(&mgr.settings)
        .map_err(|e| format!("Export error: {}", e))
}

#[tauri::command]
pub async fn config_import_settings(
    state: State<'_, ManagedConfigManager>,
    json: String,
) -> Result<AppSettings, String> {
    let settings: AppSettings = serde_json::from_str(&json)
        .map_err(|e| format!("Import error: {}", e))?;
    let mut mgr = state.lock().await;
    mgr.update_settings(settings.clone())?;
    Ok(settings)
}

#[tauri::command]
pub async fn config_export_preset(
    state: State<'_, ManagedConfigManager>,
    id: String,
) -> Result<String, String> {
    let mgr = state.lock().await;
    let preset = mgr.presets.iter().find(|p| p.id == id)
        .ok_or_else(|| format!("Preset not found: {}", id))?;
    serde_json::to_string_pretty(preset)
        .map_err(|e| format!("Export error: {}", e))
}

#[tauri::command]
pub async fn config_import_preset(
    state: State<'_, ManagedConfigManager>,
    json: String,
) -> Result<Preset, String> {
    let mut preset: Preset = serde_json::from_str(&json)
        .map_err(|e| format!("Import error: {}", e))?;
    // Generate new ID to avoid conflicts
    preset.id = format!("preset_{}", uuid::Uuid::new_v4().to_string().replace("-", "")[..12].to_string());
    preset.updated_at = chrono::Utc::now().to_rfc3339();
    let mut mgr = state.lock().await;
    mgr.save_preset_file(&preset)?;
    mgr.presets.push(preset.clone());
    mgr.presets.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(preset)
}
