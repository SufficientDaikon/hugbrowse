use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use tauri::{AppHandle, Emitter, Manager, State};
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
    pub gpu_device: Option<u32>,
    pub error: Option<String>,
}

impl InferenceInfo {
    pub fn default() -> Self {
        Self {
            status: InferenceStatus::Unloaded,
            model_path: None,
            model_name: None,
            port: 11434,
            ctx_size: 4096,
            n_gpu_layers: -1,
            gpu_device: None,
            error: None,
        }
    }
}

/// EC-007: GPU info for multi-GPU selection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuInfo {
    pub id: u32,
    pub name: String,
    pub vendor: String,
    pub vram_mb: Option<u64>,
}

pub struct InferenceManager {
    pub info: InferenceInfo,
    pub child: Option<CommandChild>,
}

pub type ManagedInference = Arc<Mutex<InferenceManager>>;

/// FR-020 + EC-003: Verify sidecar binary integrity via SHA-256 checksum.
/// Returns Ok(true) if valid, Ok(false) if mismatch, Err if binary not found.
#[tauri::command]
pub fn verify_sidecar_checksum(app: AppHandle) -> Result<bool, String> {
    use std::io::Read;

    // Resolve sidecar path via Tauri's resource directory
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Cannot resolve resource dir: {e}"))?;

    #[cfg(target_os = "windows")]
    let sidecar_name = "llama-server.exe";
    #[cfg(target_os = "macos")]
    let sidecar_name = "llama-server";
    #[cfg(target_os = "linux")]
    let sidecar_name = "llama-server";

    let sidecar_path = resource_dir.join(sidecar_name);
    if !sidecar_path.exists() {
        return Err(format!("Sidecar binary not found at {}", sidecar_path.display()));
    }

    // Read and hash the binary
    let mut file = std::fs::File::open(&sidecar_path)
        .map_err(|e| format!("Failed to open sidecar binary: {e}"))?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 8192];
    loop {
        let n = file.read(&mut buf).map_err(|e| format!("Read error: {e}"))?;
        if n == 0 { break; }
        hasher.update(&buf[..n]);
    }
    let hash = format!("{:x}", hasher.finalize());

    // Compare against expected checksum stored in a .sha256 file alongside
    let checksum_path = sidecar_path.with_extension("sha256");
    if checksum_path.exists() {
        let expected = std::fs::read_to_string(&checksum_path)
            .map_err(|e| format!("Failed to read checksum file: {e}"))?
            .trim()
            .to_lowercase();
        Ok(hash == expected)
    } else {
        // No checksum file — write one for future verification
        let _ = std::fs::write(&checksum_path, &hash);
        Ok(true)
    }
}

/// EC-007: Enumerate available GPUs across platforms
#[tauri::command]
pub fn get_gpus() -> Vec<GpuInfo> {
    let mut gpus = Vec::new();

    #[cfg(target_os = "windows")]
    {
        // Try nvidia-smi first for NVIDIA GPUs
        if let Ok(output) = std::process::Command::new("nvidia-smi")
            .args(["--query-gpu=index,name,memory.total", "--format=csv,noheader,nounits"])
            .output()
        {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                for line in stdout.lines() {
                    let parts: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
                    if parts.len() >= 3 {
                        gpus.push(GpuInfo {
                            id: parts[0].parse().unwrap_or(0),
                            name: parts[1].to_string(),
                            vendor: "NVIDIA".into(),
                            vram_mb: parts[2].parse().ok(),
                        });
                    }
                }
            }
        }

        // Also check for integrated GPUs via wmic
        if let Ok(output) = std::process::Command::new("wmic")
            .args(["path", "win32_VideoController", "get", "Name,AdapterRAM", "/value"])
            .output()
        {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let mut name = String::new();
                let mut vram: Option<u64> = None;
                for line in stdout.lines() {
                    let line = line.trim();
                    if let Some(n) = line.strip_prefix("Name=") {
                        name = n.to_string();
                    }
                    if let Some(r) = line.strip_prefix("AdapterRAM=") {
                        vram = r.parse::<u64>().ok().map(|v| v / (1024 * 1024));
                    }
                    if !name.is_empty() && vram.is_some() {
                        // Avoid duplicates with nvidia-smi
                        if !gpus.iter().any(|g| name.contains(&g.name) || g.name.contains(&name)) {
                            let id = gpus.len() as u32;
                            let vendor = if name.to_lowercase().contains("nvidia") {
                                "NVIDIA"
                            } else if name.to_lowercase().contains("amd") || name.to_lowercase().contains("radeon") {
                                "AMD"
                            } else {
                                "Intel"
                            };
                            gpus.push(GpuInfo { id, name: name.clone(), vendor: vendor.into(), vram_mb: vram });
                        }
                        name.clear();
                        vram = None;
                    }
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        // NFR-012: macOS GPU detection via system_profiler
        if let Ok(output) = std::process::Command::new("system_profiler")
            .args(["SPDisplaysDataType", "-json"])
            .output()
        {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                // Simple parse — look for "chipset_model" keys
                for (i, line) in stdout.lines().enumerate() {
                    let line = line.trim();
                    if line.contains("sppci_model") || line.contains("chipset_model") {
                        if let Some(name) = line.split(':').nth(1) {
                            let name = name.trim().trim_matches('"').trim_matches(',').to_string();
                            let vendor = if name.contains("Apple") { "Apple" } else { "Unknown" };
                            gpus.push(GpuInfo {
                                id: i as u32,
                                name,
                                vendor: vendor.into(),
                                vram_mb: None,
                            });
                        }
                    }
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        // NFR-012: Linux GPU detection via lspci
        if let Ok(output) = std::process::Command::new("lspci").output() {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let mut gpu_idx = 0u32;
                for line in stdout.lines() {
                    if line.contains("VGA") || line.contains("3D controller") || line.contains("Display controller") {
                        let name = line.split(':').last().unwrap_or("Unknown GPU").trim().to_string();
                        let vendor = if name.to_lowercase().contains("nvidia") {
                            "NVIDIA"
                        } else if name.to_lowercase().contains("amd") || name.to_lowercase().contains("radeon") {
                            "AMD"
                        } else {
                            "Intel"
                        };
                        gpus.push(GpuInfo { id: gpu_idx, name, vendor: vendor.into(), vram_mb: None });
                        gpu_idx += 1;
                    }
                }
            }
        }

        // Also try nvidia-smi for detailed NVIDIA info
        if let Ok(output) = std::process::Command::new("nvidia-smi")
            .args(["--query-gpu=index,name,memory.total", "--format=csv,noheader,nounits"])
            .output()
        {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                // Replace NVIDIA entries with detailed info
                gpus.retain(|g| g.vendor != "NVIDIA");
                for line in stdout.lines() {
                    let parts: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
                    if parts.len() >= 3 {
                        gpus.push(GpuInfo {
                            id: parts[0].parse().unwrap_or(0),
                            name: parts[1].to_string(),
                            vendor: "NVIDIA".into(),
                            vram_mb: parts[2].parse().ok(),
                        });
                    }
                }
            }
        }
    }

    gpus
}

/// NFR-004: Check if model fits in available memory
#[tauri::command]
pub fn check_model_memory(model_path: String) -> Result<(bool, String), String> {
    let meta = std::fs::metadata(&model_path)
        .map_err(|e| format!("Cannot read model file: {e}"))?;
    let model_size_mb = meta.len() / (1024 * 1024);
    let overhead_mb = 512u64;
    let required_mb = model_size_mb + overhead_mb;

    // Get available system memory
    let mut available_mb = u64::MAX;
    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = std::process::Command::new("wmic")
            .args(["OS", "get", "FreePhysicalMemory", "/value"])
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                if let Some(val) = line.trim().strip_prefix("FreePhysicalMemory=") {
                    available_mb = val.parse::<u64>().unwrap_or(u64::MAX) / 1024;
                }
            }
        }
    }
    #[cfg(target_os = "linux")]
    {
        if let Ok(meminfo) = std::fs::read_to_string("/proc/meminfo") {
            for line in meminfo.lines() {
                if let Some(val) = line.strip_prefix("MemAvailable:") {
                    available_mb = val.trim().split_whitespace().next()
                        .and_then(|v| v.parse::<u64>().ok())
                        .unwrap_or(u64::MAX) / 1024;
                }
            }
        }
    }
    #[cfg(target_os = "macos")]
    {
        if let Ok(output) = std::process::Command::new("sysctl")
            .args(["-n", "hw.memsize"])
            .output()
        {
            let total_bytes: u64 = String::from_utf8_lossy(&output.stdout)
                .trim().parse().unwrap_or(0);
            // macOS doesn't have MemAvailable easily, use ~60% of total as estimate
            available_mb = (total_bytes / (1024 * 1024)) * 60 / 100;
        }
    }

    if required_mb > available_mb {
        Ok((false, format!(
            "Model requires ~{required_mb} MB but only {available_mb} MB available. Loading may cause system instability."
        )))
    } else {
        Ok((true, format!(
            "Model requires ~{required_mb} MB. {available_mb} MB available."
        )))
    }
}

#[tauri::command]
pub async fn load_model(
    app: AppHandle,
    state: State<'_, ManagedInference>,
    model_path: String,
    model_name: String,
    port: Option<u16>,
    ctx_size: Option<u32>,
    n_gpu_layers: Option<i32>,
    gpu_device: Option<u32>,
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
        mgr.info.port = port.unwrap_or(11434);
        mgr.info.ctx_size = ctx_size.unwrap_or(4096);
        mgr.info.n_gpu_layers = n_gpu_layers.unwrap_or(-1);
        mgr.info.gpu_device = gpu_device;
        mgr.info.error = None;
    }

    let (port_val, ctx_val, gpu_layers_val, gpu_dev) = {
        let mgr = state.lock().unwrap();
        (mgr.info.port, mgr.info.ctx_size, mgr.info.n_gpu_layers, mgr.info.gpu_device)
    };

    // EC-002: Check for port collision before spawning
    let listener = std::net::TcpListener::bind(format!("127.0.0.1:{port_val}"));
    match listener {
        Ok(l) => drop(l), // Port is free, release it for llama-server
        Err(_) => {
            let mut mgr = state.lock().unwrap();
            mgr.info.status = InferenceStatus::Error;
            mgr.info.error = Some(format!(
                "Port {port_val} is already in use. Please choose a different port."
            ));
            return Ok(mgr.info.clone());
        }
    }

    // NFR-011: Select sidecar binary based on GPU vendor
    let sidecar_name = select_sidecar_binary();
    let sidecar = app
        .shell()
        .sidecar(&sidecar_name)
        .map_err(|e| format!("sidecar not found — ensure llama-server binary is in src-tauri/binaries/: {e}"))?;

    // Build args — EC-007: include --main-gpu if selected
    let mut args = vec![
        "--model".to_string(),
        model_path.clone(),
        "--port".to_string(),
        port_val.to_string(),
        "--ctx-size".to_string(),
        ctx_val.to_string(),
        "--n-gpu-layers".to_string(),
        gpu_layers_val.to_string(),
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
                let result = mgr.info.clone();
                drop(mgr);
                // Spawn background health polling (NFR-009: crash detection)
                spawn_health_poller(app.clone(), state.inner().clone(), port_val);
                return Ok(result);
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

/// Background health poller — checks llama-server every 2s (NFR-009).
/// If 3 consecutive checks fail, marks status as Error and emits event.
fn spawn_health_poller(app: AppHandle, state: ManagedInference, port: u16) {
    tokio::spawn(async move {
        let client = reqwest::Client::new();
        let url = format!("http://127.0.0.1:{port}/health");
        let mut consecutive_failures = 0u32;
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            // Stop polling if model was unloaded
            {
                let mgr = state.lock().unwrap();
                if mgr.info.status != InferenceStatus::Running {
                    return;
                }
            }
            match client.get(&url).send().await {
                Ok(resp) if resp.status().is_success() => {
                    consecutive_failures = 0;
                }
                _ => {
                    consecutive_failures += 1;
                    if consecutive_failures >= 3 {
                        let mut mgr = state.lock().unwrap();
                        mgr.info.status = InferenceStatus::Error;
                        mgr.info.error = Some("llama-server crashed or became unresponsive".into());
                        let _ = app.emit("inference-status", mgr.info.clone());
                        return;
                    }
                }
            }
        }
    });
}

#[tauri::command]
pub async fn unload_model(state: State<'_, ManagedInference>) -> Result<InferenceInfo, String> {
    let (port_val, child_opt) = {
        let mut mgr = state.lock().unwrap();
        let port = mgr.info.port;
        let child = mgr.child.take();
        (port, child)
    };

    if let Some(child) = child_opt {
        // Try graceful shutdown via llama-server's API first
        let client = reqwest::Client::new();
        let _ = client
            .post(format!("http://127.0.0.1:{port_val}/shutdown"))
            .send()
            .await;
        // Grace period: wait up to 5 seconds for process to exit
        tokio::time::sleep(std::time::Duration::from_secs(5)).await;
        // Force kill if still alive
        let _ = child.kill();
    }

    let mut mgr = state.lock().unwrap();
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

/// NFR-011: Select the appropriate sidecar binary based on detected GPU
fn select_sidecar_binary() -> String {
    // Check for NVIDIA GPU (CUDA)
    #[cfg(target_os = "windows")]
    {
        if std::process::Command::new("nvidia-smi").output().map(|o| o.status.success()).unwrap_or(false) {
            return "llama-server-cuda".into();
        }
    }
    #[cfg(target_os = "linux")]
    {
        if std::process::Command::new("nvidia-smi").output().map(|o| o.status.success()).unwrap_or(false) {
            return "llama-server-cuda".into();
        }
    }
    #[cfg(target_os = "macos")]
    {
        // Apple Silicon uses Metal — separate binary
        return "llama-server-metal".into();
    }

    // Fallback: CPU-only binary
    "llama-server".into()
}

/// FR-031: Check if server is running, return 503-equivalent status if not
#[tauri::command]
pub fn check_api_ready(state: State<'_, ManagedInference>) -> Result<bool, String> {
    let mgr = state.lock().unwrap();
    match mgr.info.status {
        InferenceStatus::Running => Ok(true),
        _ => Err("503 Service Unavailable: No model is currently loaded".into()),
    }
}
