//! Model Management Engine — Phase 1 of HugBrowse v1.0
//!
//! Manages the lifecycle of loaded LLM models: load, unload, JIT loading,
//! TTL auto-unload, auto-eviction, multi-instance support, and health checks.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandChild;
use tokio::sync::Mutex;
use uuid::Uuid;

/// How a model was loaded — determines eviction eligibility.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LoadSource {
    /// Explicitly loaded by user — protected from auto-eviction.
    Explicit,
    /// Loaded on-demand by JIT — eligible for auto-eviction.
    Jit,
}

/// Status of a loaded model instance.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ModelStatus {
    Loading,
    Ready,
    Error,
    Unloading,
}

/// Options for loading a model.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadOptions {
    /// GPU offload: "off", "max", or a float 0.0–1.0
    #[serde(default = "default_gpu")]
    pub gpu: String,
    /// Context length override
    pub context_length: Option<u32>,
    /// Custom alias for API reference
    pub identifier: Option<String>,
    /// Seconds before auto-unload (0 = never)
    pub ttl: Option<u64>,
    /// GPU device index
    pub gpu_device: Option<u32>,
}

fn default_gpu() -> String {
    "max".to_string()
}

impl Default for LoadOptions {
    fn default() -> Self {
        Self {
            gpu: "max".to_string(),
            context_length: None,
            identifier: None,
            ttl: None,
            gpu_device: None,
        }
    }
}

/// A loaded model instance with runtime metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadedModel {
    pub instance_id: String,
    pub model_path: String,
    pub model_name: String,
    pub identifier: String,
    pub status: ModelStatus,
    pub loaded_at: u64,
    pub last_used_at: u64,
    pub vram_usage_mb: u64,
    pub ram_usage_mb: u64,
    pub context_length: u32,
    pub gpu_offload: String,
    pub port: u16,
    pub ttl_seconds: u64,
    pub request_count: u64,
    pub load_source: LoadSource,
    pub health_retries: u32,
    pub error: Option<String>,
}

/// Memory information for the system.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryInfo {
    pub total_ram_mb: u64,
    pub available_ram_mb: u64,
    pub total_vram_mb: Option<u64>,
    pub available_vram_mb: Option<u64>,
    pub models_ram_mb: u64,
    pub models_vram_mb: u64,
}

/// Configuration for the model manager.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelManagerConfig {
    pub default_gpu: String,
    pub default_context_length: u32,
    pub default_ttl_seconds: u64,
    pub auto_evict: bool,
    pub jit_loading: bool,
    pub max_health_retries: u32,
}

impl Default for ModelManagerConfig {
    fn default() -> Self {
        Self {
            default_gpu: "max".to_string(),
            default_context_length: 4096,
            default_ttl_seconds: 3600,
            auto_evict: true,
            jit_loading: true,
            max_health_retries: 3,
        }
    }
}

/// Error type for model operations.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelError {
    pub code: String,
    pub message: String,
}

impl std::fmt::Display for ModelError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

impl From<ModelError> for String {
    fn from(e: ModelError) -> String {
        format!("{}: {}", e.code, e.message)
    }
}

/// The core model manager — holds all loaded model instances.
pub struct ModelManager {
    pub loaded_models: HashMap<String, LoadedModel>,
    pub children: HashMap<String, CommandChild>,
    pub config: ModelManagerConfig,
    next_port: u16,
    #[allow(dead_code)]
    ttl_task_running: bool,
}

/// Thread-safe handle to the model manager.
pub type ManagedModelManager = Arc<Mutex<ModelManager>>;

impl ModelManager {
    pub fn new() -> Self {
        Self {
            loaded_models: HashMap::new(),
            children: HashMap::new(),
            config: ModelManagerConfig::default(),
            next_port: 11435,
            ttl_task_running: false,
        }
    }

    /// Allocate the next available port for a llama-server instance.
    fn allocate_port(&mut self) -> u16 {
        loop {
            let port = self.next_port;
            self.next_port += 1;
            // Skip ports already in use by loaded models
            let in_use = self.loaded_models.values().any(|m| m.port == port);
            if !in_use {
                // Check if port is actually free on the system
                if std::net::TcpListener::bind(format!("127.0.0.1:{port}")).is_ok() {
                    return port;
                }
            }
        }
    }

    /// Get an identifier for the model, using custom alias or generating from name.
    fn make_identifier(name: &str, custom: Option<&str>) -> String {
        custom.unwrap_or(name).to_string()
    }

    /// Find the LRU (least recently used) JIT-loaded model for eviction.
    pub fn find_lru_jit_model(&self) -> Option<String> {
        self.loaded_models
            .iter()
            .filter(|(_, m)| m.load_source == LoadSource::Jit && m.status == ModelStatus::Ready)
            .min_by_key(|(_, m)| m.last_used_at)
            .map(|(id, _)| id.clone())
    }

    /// Check if any model is loaded with the given path.
    pub fn find_by_path(&self, path: &str) -> Option<&LoadedModel> {
        self.loaded_models.values().find(|m| m.model_path == path)
    }

    /// Check if any model is loaded with the given identifier.
    pub fn find_by_identifier(&self, identifier: &str) -> Option<&LoadedModel> {
        self.loaded_models.values().find(|m| m.identifier == identifier)
    }

    /// Mark a model as recently used.
    pub fn touch(&mut self, instance_id: &str) {
        if let Some(model) = self.loaded_models.get_mut(instance_id) {
            model.last_used_at = now_epoch();
            model.request_count += 1;
        }
    }
}

/// Current epoch timestamp in seconds.
fn now_epoch() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

/// Estimate model memory usage from file size (rough heuristic).
fn estimate_memory_mb(model_path: &str) -> (u64, u64) {
    let file_size_mb = std::fs::metadata(model_path)
        .map(|m| m.len() / (1024 * 1024))
        .unwrap_or(0);
    // Rough estimate: VRAM ≈ file size + 10% overhead, RAM ≈ 200MB baseline
    let vram = file_size_mb + file_size_mb / 10;
    let ram = 200;
    (vram, ram)
}

/// Select the appropriate sidecar binary based on detected GPU.
fn select_sidecar_binary() -> String {
    #[cfg(target_os = "windows")]
    {
        if std::process::Command::new("nvidia-smi")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
        {
            return "llama-server-cuda".into();
        }
    }
    #[cfg(target_os = "linux")]
    {
        if std::process::Command::new("nvidia-smi")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
        {
            return "llama-server-cuda".into();
        }
    }
    #[cfg(target_os = "macos")]
    {
        return "llama-server-metal".into();
    }

    "llama-server".into()
}

/// Resolve n_gpu_layers from the gpu option string.
fn resolve_gpu_layers(gpu: &str) -> i32 {
    match gpu {
        "off" | "0" => 0,
        "max" => -1, // -1 means all layers
        other => {
            // Treat as ratio 0.0–1.0, map to approximate layer count
            if let Ok(ratio) = other.parse::<f64>() {
                if ratio <= 0.0 {
                    0
                } else if ratio >= 1.0 {
                    -1
                } else {
                    // Use 99 * ratio as a rough layer count
                    (99.0 * ratio) as i32
                }
            } else {
                -1 // Default to max
            }
        }
    }
}

// ── Tauri Commands ────────────────────────────────────────────────────

/// Load a model with the given options. Returns the loaded model instance.
#[tauri::command]
pub async fn mm_load_model(
    app: AppHandle,
    state: State<'_, ManagedModelManager>,
    model_path: String,
    model_name: String,
    options: Option<LoadOptions>,
) -> Result<LoadedModel, String> {
    let opts = options.unwrap_or_default();
    let instance_id = Uuid::new_v4().to_string();
    let now = now_epoch();

    let (port, ctx, gpu_layers, gpu_dev) = {
        let mut mgr = state.lock().await;
        let port = mgr.allocate_port();
        let ctx = opts.context_length.unwrap_or(mgr.config.default_context_length);
        let gpu_layers = resolve_gpu_layers(&opts.gpu);
        let identifier = ModelManager::make_identifier(&model_name, opts.identifier.as_deref());
        let ttl = opts.ttl.unwrap_or(mgr.config.default_ttl_seconds);
        let (vram_est, ram_est) = estimate_memory_mb(&model_path);

        let loaded = LoadedModel {
            instance_id: instance_id.clone(),
            model_path: model_path.clone(),
            model_name: model_name.clone(),
            identifier,
            status: ModelStatus::Loading,
            loaded_at: now,
            last_used_at: now,
            vram_usage_mb: vram_est,
            ram_usage_mb: ram_est,
            context_length: ctx,
            gpu_offload: opts.gpu.clone(),
            port,
            ttl_seconds: ttl,
            request_count: 0,
            load_source: LoadSource::Explicit,
            health_retries: 0,
            error: None,
        };
        mgr.loaded_models.insert(instance_id.clone(), loaded);
        (port, ctx, gpu_layers, opts.gpu_device)
    };

    // Emit loading status
    let _ = app.emit("model-status-changed", serde_json::json!({
        "instanceId": &instance_id,
        "status": "loading"
    }));

    // Spawn llama-server sidecar
    let sidecar_name = select_sidecar_binary();
    let sidecar = app
        .shell()
        .sidecar(&sidecar_name)
        .map_err(|e| format!("Sidecar not found: {e}"))?;

    let mut args = vec![
        "--model".to_string(),
        model_path.clone(),
        "--port".to_string(),
        port.to_string(),
        "--ctx-size".to_string(),
        ctx.to_string(),
        "--n-gpu-layers".to_string(),
        gpu_layers.to_string(),
        "--host".to_string(),
        "127.0.0.1".to_string(),
    ];
    if let Some(dev) = gpu_dev {
        args.push("--main-gpu".to_string());
        args.push(dev.to_string());
    }

    let (_, child) = sidecar
        .args(&args.iter().map(|s| s.as_str()).collect::<Vec<_>>())
        .spawn()
        .map_err(|e| {
            // Clean up on spawn failure
            let mgr_clone = state.inner().clone();
            let id_clone = instance_id.clone();
            tauri::async_runtime::spawn(async move {
                let mut mgr = mgr_clone.lock().await;
                mgr.loaded_models.remove(&id_clone);
            });
            format!("Failed to spawn llama-server: {e}")
        })?;

    // Store child process
    {
        let mut mgr = state.lock().await;
        mgr.children.insert(instance_id.clone(), child);
    }

    // Poll /health until ready (max 60s)
    let health_url = format!("http://127.0.0.1:{port}/health");
    let client = reqwest::Client::new();
    let mut ready = false;
    for _ in 0..120 {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        if let Ok(resp) = client.get(&health_url).send().await {
            if resp.status().is_success() {
                ready = true;
                break;
            }
        }
    }

    let mut mgr = state.lock().await;
    if ready {
        if let Some(model) = mgr.loaded_models.get_mut(&instance_id) {
            model.status = ModelStatus::Ready;
            let result = model.clone();
            drop(mgr);

            let _ = app.emit("model-status-changed", serde_json::json!({
                "instanceId": &instance_id,
                "status": "ready"
            }));

            // Start health checker for this instance
            spawn_instance_health_checker(
                app.clone(),
                state.inner().clone(),
                instance_id.clone(),
                port,
            );

            return Ok(result);
        }
    }

    // Timeout — clean up
    if let Some(child) = mgr.children.remove(&instance_id) {
        let _ = child.kill();
    }
    if let Some(model) = mgr.loaded_models.get_mut(&instance_id) {
        model.status = ModelStatus::Error;
        model.error = Some("llama-server did not become healthy within 60s".into());
        let result = model.clone();
        drop(mgr);

        let _ = app.emit("model-status-changed", serde_json::json!({
            "instanceId": &instance_id,
            "status": "error",
            "error": "llama-server did not become healthy within 60s"
        }));

        return Ok(result);
    }

    Err("Model loading failed unexpectedly".into())
}

/// Unload a specific model instance by ID.
#[tauri::command]
pub async fn mm_unload_model(
    app: AppHandle,
    state: State<'_, ManagedModelManager>,
    instance_id: String,
) -> Result<(), String> {
    unload_instance(&app, state.inner(), &instance_id).await
}

/// Unload all loaded models.
#[tauri::command]
pub async fn mm_unload_all(
    app: AppHandle,
    state: State<'_, ManagedModelManager>,
) -> Result<(), String> {
    let ids: Vec<String> = {
        let mgr = state.lock().await;
        mgr.loaded_models.keys().cloned().collect()
    };
    for id in ids {
        unload_instance(&app, state.inner(), &id).await?;
    }
    Ok(())
}

/// List all currently loaded model instances.
#[tauri::command]
pub async fn mm_list_loaded_models(
    state: State<'_, ManagedModelManager>,
) -> Result<Vec<LoadedModel>, String> {
    let mgr = state.lock().await;
    Ok(mgr.loaded_models.values().cloned().collect())
}

/// Get the status of a specific model instance.
#[tauri::command]
pub async fn mm_get_model_status(
    state: State<'_, ManagedModelManager>,
    instance_id: String,
) -> Result<LoadedModel, String> {
    let mgr = state.lock().await;
    mgr.loaded_models
        .get(&instance_id)
        .cloned()
        .ok_or_else(|| format!("Model instance '{instance_id}' not found"))
}

/// Get current system memory usage including per-model breakdown.
#[tauri::command]
pub async fn mm_get_memory_usage(
    state: State<'_, ManagedModelManager>,
) -> Result<MemoryInfo, String> {
    let mgr = state.lock().await;
    let models_ram: u64 = mgr.loaded_models.values().map(|m| m.ram_usage_mb).sum();
    let models_vram: u64 = mgr.loaded_models.values().map(|m| m.vram_usage_mb).sum();

    // Get system memory info
    let sys = sysinfo::System::new_all();
    let total_ram = sys.total_memory() / (1024 * 1024);
    let available_ram = sys.available_memory() / (1024 * 1024);

    Ok(MemoryInfo {
        total_ram_mb: total_ram,
        available_ram_mb: available_ram,
        total_vram_mb: None,   // Will be enhanced with GPU detection
        available_vram_mb: None,
        models_ram_mb: models_ram,
        models_vram_mb: models_vram,
    })
}

/// Update the model manager configuration.
#[tauri::command]
pub async fn mm_update_config(
    state: State<'_, ManagedModelManager>,
    config: ModelManagerConfig,
) -> Result<(), String> {
    let mut mgr = state.lock().await;
    mgr.config = config;
    Ok(())
}

// ── API-Facing Functions (called by api_server.rs without Tauri State) ──

/// Load a model via the API server (no Tauri State extractor needed).
pub async fn api_load_model(
    app: &AppHandle,
    state: &ManagedModelManager,
    model_path: String,
    model_name: String,
    options: Option<LoadOptions>,
) -> Result<LoadedModel, String> {
    let opts = options.unwrap_or_default();
    let instance_id = Uuid::new_v4().to_string();
    let now = now_epoch();

    let (port, ctx, gpu_layers, gpu_dev) = {
        let mut mgr = state.lock().await;
        let port = mgr.allocate_port();
        let ctx = opts.context_length.unwrap_or(mgr.config.default_context_length);
        let gpu_layers = resolve_gpu_layers(&opts.gpu);
        let identifier = ModelManager::make_identifier(&model_name, opts.identifier.as_deref());
        let ttl = opts.ttl.unwrap_or(mgr.config.default_ttl_seconds);
        let (vram_est, ram_est) = estimate_memory_mb(&model_path);

        let loaded = LoadedModel {
            instance_id: instance_id.clone(),
            model_path: model_path.clone(),
            model_name: model_name.clone(),
            identifier,
            status: ModelStatus::Loading,
            loaded_at: now,
            last_used_at: now,
            vram_usage_mb: vram_est,
            ram_usage_mb: ram_est,
            context_length: ctx,
            gpu_offload: opts.gpu.clone(),
            port,
            ttl_seconds: ttl,
            request_count: 0,
            load_source: LoadSource::Jit,
            health_retries: 0,
            error: None,
        };
        mgr.loaded_models.insert(instance_id.clone(), loaded);
        (port, ctx, gpu_layers, opts.gpu_device)
    };

    let _ = app.emit("model-status-changed", serde_json::json!({
        "instanceId": &instance_id,
        "status": "loading"
    }));

    let sidecar_name = select_sidecar_binary();
    let sidecar = app
        .shell()
        .sidecar(&sidecar_name)
        .map_err(|e| format!("Sidecar not found: {e}"))?;

    let mut args = vec![
        "--model".to_string(), model_path.clone(),
        "--port".to_string(), port.to_string(),
        "--ctx-size".to_string(), ctx.to_string(),
        "--n-gpu-layers".to_string(), gpu_layers.to_string(),
        "--host".to_string(), "127.0.0.1".to_string(),
    ];
    if let Some(dev) = gpu_dev {
        args.push("--main-gpu".to_string());
        args.push(dev.to_string());
    }

    let (_, child) = sidecar
        .args(&args.iter().map(|s| s.as_str()).collect::<Vec<_>>())
        .spawn()
        .map_err(|e| {
            let st = state.clone();
            let id = instance_id.clone();
            tauri::async_runtime::spawn(async move {
                let mut mgr = st.lock().await;
                mgr.loaded_models.remove(&id);
            });
            format!("Failed to spawn llama-server: {e}")
        })?;

    {
        let mut mgr = state.lock().await;
        mgr.children.insert(instance_id.clone(), child);
    }

    let health_url = format!("http://127.0.0.1:{port}/health");
    let client = reqwest::Client::new();
    let mut ready = false;
    for _ in 0..120 {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        if let Ok(resp) = client.get(&health_url).send().await {
            if resp.status().is_success() {
                ready = true;
                break;
            }
        }
    }

    let mut mgr = state.lock().await;
    if ready {
        if let Some(model) = mgr.loaded_models.get_mut(&instance_id) {
            model.status = ModelStatus::Ready;
            let result = model.clone();
            drop(mgr);
            let _ = app.emit("model-status-changed", serde_json::json!({
                "instanceId": &instance_id,
                "status": "ready"
            }));
            spawn_instance_health_checker(app.clone(), state.clone(), instance_id, port);
            return Ok(result);
        }
    }

    if let Some(child) = mgr.children.remove(&instance_id) {
        let _ = child.kill();
    }
    if let Some(model) = mgr.loaded_models.get_mut(&instance_id) {
        model.status = ModelStatus::Error;
        model.error = Some("llama-server did not become healthy within 60s".into());
        let result = model.clone();
        drop(mgr);
        let _ = app.emit("model-status-changed", serde_json::json!({
            "instanceId": &instance_id,
            "status": "error",
            "error": "llama-server did not become healthy within 60s"
        }));
        return Ok(result);
    }

    Err("Model loading failed unexpectedly".into())
}

/// Unload a model via the API server (no Tauri State extractor needed).
pub async fn api_unload_model(
    app: &AppHandle,
    state: &ManagedModelManager,
    instance_id: &str,
) -> Result<(), String> {
    unload_instance(app, state, instance_id).await
}

// ── Internal Helpers ──────────────────────────────────────────────────

/// Unload a single model instance — graceful shutdown then force kill.
async fn unload_instance(
    app: &AppHandle,
    state: &ManagedModelManager,
    instance_id: &str,
) -> Result<(), String> {
    let (port, child) = {
        let mut mgr = state.lock().await;
        if let Some(model) = mgr.loaded_models.get_mut(instance_id) {
            model.status = ModelStatus::Unloading;
        }
        let port = mgr
            .loaded_models
            .get(instance_id)
            .map(|m| m.port)
            .unwrap_or(0);
        let child = mgr.children.remove(instance_id);
        (port, child)
    };

    // Try graceful shutdown
    if port > 0 {
        let client = reqwest::Client::new();
        let _ = client
            .post(format!("http://127.0.0.1:{port}/shutdown"))
            .send()
            .await;
        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
    }

    // Force kill if still alive
    if let Some(child) = child {
        let _ = child.kill();
    }

    // Remove from state
    {
        let mut mgr = state.lock().await;
        mgr.loaded_models.remove(instance_id);
    }

    let _ = app.emit(
        "model-status-changed",
        serde_json::json!({
            "instanceId": instance_id,
            "status": "unloaded"
        }),
    );

    Ok(())
}

/// Per-instance health checker. Checks every 5s, auto-restarts on failure (max retries).
fn spawn_instance_health_checker(
    app: AppHandle,
    state: ManagedModelManager,
    instance_id: String,
    port: u16,
) {
    tokio::spawn(async move {
        let client = reqwest::Client::new();
        let url = format!("http://127.0.0.1:{port}/health");
        let mut consecutive_failures = 0u32;

        loop {
            tokio::time::sleep(std::time::Duration::from_secs(5)).await;

            // Check if model still exists and is ready
            {
                let mgr = state.lock().await;
                match mgr.loaded_models.get(&instance_id) {
                    Some(m) if m.status == ModelStatus::Ready => {}
                    _ => return, // Model removed or not ready — stop polling
                }
            }

            match client.get(&url).send().await {
                Ok(resp) if resp.status().is_success() => {
                    consecutive_failures = 0;
                }
                _ => {
                    consecutive_failures += 1;
                    let max_retries = {
                        let mgr = state.lock().await;
                        mgr.config.max_health_retries
                    };

                    if consecutive_failures >= 2 {
                        let mut mgr = state.lock().await;
                        if let Some(model) = mgr.loaded_models.get_mut(&instance_id) {
                            if model.health_retries < max_retries {
                                model.health_retries += 1;
                                model.status = ModelStatus::Error;
                                model.error =
                                    Some("llama-server unresponsive, will retry".into());
                                let _ = app.emit(
                                    "model-status-changed",
                                    serde_json::json!({
                                        "instanceId": &instance_id,
                                        "status": "error",
                                        "error": "llama-server unresponsive",
                                        "retrying": true
                                    }),
                                );
                                // TODO: auto-restart logic (kill + respawn)
                            } else {
                                model.status = ModelStatus::Error;
                                model.error = Some(
                                    "llama-server crashed after max retries".into(),
                                );
                                let _ = app.emit(
                                    "model-status-changed",
                                    serde_json::json!({
                                        "instanceId": &instance_id,
                                        "status": "error",
                                        "error": "llama-server crashed after max retries"
                                    }),
                                );
                                return; // Stop checking
                            }
                        }
                    }
                }
            }
        }
    });
}

/// TTL checker — runs every 30s, unloads idle models exceeding their TTL.
pub fn spawn_ttl_checker(app: AppHandle, state: ManagedModelManager) {
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(30)).await;

            let expired: Vec<String> = {
                let mgr = state.lock().await;
                let now = now_epoch();
                mgr.loaded_models
                    .iter()
                    .filter(|(_, m)| {
                        m.ttl_seconds > 0
                            && m.status == ModelStatus::Ready
                            && (now - m.last_used_at) > m.ttl_seconds
                    })
                    .map(|(id, _)| id.clone())
                    .collect()
            };

            for id in expired {
                log::info!("TTL expired for model instance {id}, unloading");
                let _ = unload_instance(&app, &state, &id).await;
                let _ = app.emit(
                    "model-ttl-expired",
                    serde_json::json!({ "instanceId": &id }),
                );
            }
        }
    });
}
