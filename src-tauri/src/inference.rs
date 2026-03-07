use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandChild;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum InferenceStatus {
    Unloaded,
    Loading,
    Running,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceInfo {
    pub status: InferenceStatus,
    pub model_path: Option<String>,
    pub model_name: Option<String>,
    pub port: u16,
    pub ctx_size: u32,
    pub n_gpu_layers: i32,
    pub error: Option<String>,
}

impl InferenceInfo {
    pub fn default() -> Self {
        Self {
            status: InferenceStatus::Unloaded,
            model_path: None,
            model_name: None,
            port: 8080,
            ctx_size: 4096,
            n_gpu_layers: -1,
            error: None,
        }
    }
}

pub struct InferenceManager {
    pub info: InferenceInfo,
    pub child: Option<CommandChild>,
}

pub type ManagedInference = Arc<Mutex<InferenceManager>>;

#[tauri::command]
pub async fn load_model(
    app: AppHandle,
    state: State<'_, ManagedInference>,
    model_path: String,
    model_name: String,
    port: Option<u16>,
    ctx_size: Option<u32>,
    n_gpu_layers: Option<i32>,
) -> Result<InferenceInfo, String> {
    // Kill any running instance first
    {
        let mut mgr = state.lock().unwrap();
        if let Some(child) = mgr.child.take() {
            let _ = child.kill();
        }
        mgr.info.status = InferenceStatus::Loading;
        mgr.info.model_path = Some(model_path.clone());
        mgr.info.model_name = Some(model_name.clone());
        mgr.info.port = port.unwrap_or(8080);
        mgr.info.ctx_size = ctx_size.unwrap_or(4096);
        mgr.info.n_gpu_layers = n_gpu_layers.unwrap_or(-1);
        mgr.info.error = None;
    }

    let (port_val, ctx_val, gpu_layers_val) = {
        let mgr = state.lock().unwrap();
        (mgr.info.port, mgr.info.ctx_size, mgr.info.n_gpu_layers)
    };

    let sidecar = app
        .shell()
        .sidecar("llama-server")
        .map_err(|e| format!("sidecar not found — ensure llama-server binary is in src-tauri/binaries/: {e}"))?;

    let (_, child) = sidecar
        .args([
            "--model",
            &model_path,
            "--port",
            &port_val.to_string(),
            "--ctx-size",
            &ctx_val.to_string(),
            "--n-gpu-layers",
            &gpu_layers_val.to_string(),
            "--host",
            "127.0.0.1",
        ])
        .spawn()
        .map_err(|e| format!("Failed to spawn llama-server: {e}"))?;

    {
        state.lock().unwrap().child = Some(child);
    }

    // Poll /health until ready (max 30 s)
    let health_url = format!("http://127.0.0.1:{port_val}/health");
    let client = reqwest::Client::new();
    for _ in 0..60 {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        if let Ok(resp) = client.get(&health_url).send().await {
            if resp.status().is_success() {
                let mut mgr = state.lock().unwrap();
                mgr.info.status = InferenceStatus::Running;
                return Ok(mgr.info.clone());
            }
        }
    }

    // Timeout
    let mut mgr = state.lock().unwrap();
    if let Some(child) = mgr.child.take() {
        let _ = child.kill();
    }
    mgr.info.status = InferenceStatus::Error;
    mgr.info.error = Some("llama-server did not become healthy within 30 s".into());
    Ok(mgr.info.clone())
}

#[tauri::command]
pub fn unload_model(state: State<'_, ManagedInference>) -> Result<InferenceInfo, String> {
    let mut mgr = state.lock().unwrap();
    if let Some(child) = mgr.child.take() {
        let _ = child.kill();
    }
    mgr.info.status = InferenceStatus::Unloaded;
    mgr.info.model_path = None;
    mgr.info.model_name = None;
    mgr.info.error = None;
    Ok(mgr.info.clone())
}

#[tauri::command]
pub fn get_inference_status(state: State<'_, ManagedInference>) -> InferenceInfo {
    state.lock().unwrap().info.clone()
}
