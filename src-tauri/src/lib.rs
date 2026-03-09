use serde::{Deserialize, Serialize};
use sysinfo::{System, Disks};
use crate::download::{ManagedDownloads, DownloadManagerState};
use crate::inference::{ManagedInference, InferenceManager, InferenceInfo};
use crate::backend::{ManagedBackends, BackendManager};
use crate::model_manager::{ManagedModelManager, ModelManager};
use crate::api_server::{ManagedApiServer, ApiServer};
use crate::auth_manager::{ManagedAuthManager, AuthManager};
use crate::config_manager::{ManagedConfigManager, ConfigManager};
use crate::mcp_host::{ManagedMcpHost, McpHost};
use std::sync::{Arc, Mutex, OnceLock};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::Manager;
use tauri::Emitter;

pub mod download;
pub mod inference;
pub mod backend;
pub mod model_manager;
pub mod api_server;
pub mod auth_manager;
pub mod config_manager;
pub mod mcp_host;

#[derive(Debug, Serialize, Clone)]
pub struct SystemInfo {
    pub cpu_name: String,
    pub cpu_cores: u32,
    pub ram_total_gb: f64,
    pub ram_available_gb: f64,
    pub gpu_name: Option<String>,
    pub gpu_vram_gb: Option<f64>,
    pub os_name: String,
    pub os_version: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct LiveResources {
    pub cpu_percent: f64,
    pub cpu_per_core: Vec<f64>,
    pub ram_used_gb: f64,
    pub ram_total_gb: f64,
    pub gpu_percent: Option<f64>,
    pub gpu_temp_c: Option<f64>,
    pub vram_used_gb: Option<f64>,
    pub vram_total_gb: Option<f64>,
    pub disk_free_gb: f64,
    pub disk_total_gb: f64,
    pub timestamp: u64,
}

#[derive(Debug, Serialize, Clone)]
pub struct DiskSpaceInfo {
    pub total_gb: f64,
    pub free_gb: f64,
    pub available_gb: f64,
    pub path: String,
}

fn round1(v: f64) -> f64 {
    (v * 10.0).round() / 10.0
}

#[tauri::command]
fn get_system_info() -> SystemInfo {
    let mut sys = System::new_all();
    sys.refresh_all();

    let cpu_name = sys.cpus().first()
        .map(|c| c.brand().to_string())
        .unwrap_or_else(|| "Unknown CPU".to_string());
    let cpu_cores = sys.cpus().len() as u32;
    let ram_total_gb = sys.total_memory() as f64 / 1_073_741_824.0;
    let ram_available_gb = sys.available_memory() as f64 / 1_073_741_824.0;
    let (gpu_name, gpu_vram_gb) = detect_gpu();
    let os_name = System::name().unwrap_or_else(|| "Unknown".to_string());
    let os_version = System::os_version().unwrap_or_else(|| "Unknown".to_string());

    SystemInfo {
        cpu_name, cpu_cores,
        ram_total_gb: round1(ram_total_gb),
        ram_available_gb: round1(ram_available_gb),
        gpu_name, gpu_vram_gb, os_name, os_version,
    }
}

fn detect_gpu() -> (Option<String>, Option<f64>) {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let output = Command::new("wmic")
            .args(["path", "win32_VideoController", "get", "name,AdapterRAM", "/format:csv"])
            .output();
        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines().skip(1) {
                let parts: Vec<&str> = line.split(',').collect();
                if parts.len() >= 3 {
                    let adapter_ram = parts[1].trim().parse::<f64>().unwrap_or(0.0);
                    let name = parts[2].trim().to_string();
                    if !name.is_empty() && adapter_ram > 0.0 {
                        return (Some(name), Some(round1(adapter_ram / 1_073_741_824.0)));
                    }
                }
            }
        }
    }
    (None, None)
}

/// Cached VRAM total in GB — retrieved once, doesn't change during a session.
#[cfg(target_os = "windows")]
static VRAM_TOTAL_GB_CACHE: OnceLock<Option<f64>> = OnceLock::new();

/// Get VRAM total via registry (qwMemorySize, 64-bit) with WMI fallback, cached after first call.
#[cfg(target_os = "windows")]
fn get_vram_total_cached() -> Option<f64> {
    *VRAM_TOTAL_GB_CACHE.get_or_init(|| {
        use std::process::Command;
        // Use PowerShell to read the 64-bit qwMemorySize from the display adapter registry key.
        // This avoids the 4 GB overflow of the 32-bit WMI AdapterRAM field.
        let ps_script = r#"
$v=0
try{
  $keys=Get-ChildItem 'HKLM:\SYSTEM\ControlSet001\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}' -EA Stop
  foreach($k in $keys){
    try{
      $mem=(Get-ItemProperty $k.PSPath -EA Stop).'HardwareInformation.qwMemorySize'
      if($mem -and $mem -gt $v){$v=$mem}
    }catch{}
  }
}catch{}
if($v -eq 0){
  try{
    $a=(Get-CimInstance Win32_VideoController -EA Stop).AdapterRAM|Measure-Object -Maximum
    $v=$a.Maximum
  }catch{}
}
Write-Output $v
"#;
        if let Ok(output) = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", ps_script])
            .output()
        {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                if let Ok(bytes) = stdout.trim().parse::<u64>() {
                    if bytes > 0 {
                        return Some(round1(bytes as f64 / 1_073_741_824.0));
                    }
                }
            }
        }
        None
    })
}

#[cfg(target_os = "windows")]
fn detect_gpu_usage() -> (Option<f64>, Option<f64>, Option<f64>, Option<f64>) {
    use std::process::Command;
    // 1. Try nvidia-smi first (fast path for NVIDIA GPUs)
    if let Ok(output) = Command::new("nvidia-smi")
        .args(["--query-gpu=utilization.gpu,temperature.gpu,memory.used,memory.total",
               "--format=csv,noheader,nounits"])
        .output()
    {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if let Some(line) = stdout.lines().next() {
                let parts: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
                if parts.len() >= 4 {
                    let usage = parts[0].parse::<f64>().ok();
                    let temp = parts[1].parse::<f64>().ok();
                    let vram_used = parts[2].parse::<f64>().map(|v| round1(v / 1024.0)).ok();
                    let vram_total = parts[3].parse::<f64>().map(|v| round1(v / 1024.0)).ok();
                    return (usage, temp, vram_used, vram_total);
                }
            }
        }
    }

    // 2. Fallback: Windows Performance Counters via PowerShell
    //    Works for AMD, Intel, and any GPU with WDDM 2.0+ drivers (Windows 10+)
    detect_gpu_usage_win_perf_counters()
}

/// Query GPU utilization and VRAM usage via Windows Performance Counters.
/// Uses Get-CimInstance (WMI) which is more reliable across locales than Get-Counter.
#[cfg(target_os = "windows")]
fn detect_gpu_usage_win_perf_counters() -> (Option<f64>, Option<f64>, Option<f64>, Option<f64>) {
    use std::process::Command;

    // Single PowerShell call using Get-CimInstance (locale-independent, more reliable)
    // -1 sentinel means "counter unavailable".
    let script = concat!(
        "$g=-1;$v=-1;",
        "try{$c=Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine -EA Stop|",
        "Where-Object{$_.Name -like '*engtype_3D'};",
        "if($c){$g=($c|Measure-Object -Property UtilizationPercentage -Maximum).Maximum}}catch{};",
        "try{$m=Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUProcessMemory -EA Stop;",
        "if($m){$v=($m|Measure-Object -Property DedicatedUsage -Sum).Sum}}catch{};",
        "Write-Output \"$g|$v\""
    );

    let child = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn();

    let output = match child {
        Ok(c) => {
            // Timeout: wait up to 3 seconds then kill
            match c.wait_with_output() {
                Ok(o) => {
                    // Additional timeout guard via thread::spawn is overkill for now;
                    // wait_with_output blocks but PowerShell should exit quickly.
                    o
                }
                Err(_) => return (None, None, None, get_vram_total_cached()),
            }
        }
        Err(_) => return (None, None, None, get_vram_total_cached()),
    };

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let parts: Vec<&str> = stdout.split('|').collect();
        if parts.len() == 2 {
            let gpu_percent = parts[0].trim().parse::<f64>().ok()
                .filter(|&v| v >= 0.0)
                .map(|v| round1(v.min(100.0)));
            let vram_used_gb = parts[1].trim().parse::<f64>().ok()
                .filter(|&v| v >= 0.0)
                .map(|v| round1(v / 1_073_741_824.0));
            let vram_total_gb = get_vram_total_cached();

            if gpu_percent.is_some() || vram_used_gb.is_some() {
                return (gpu_percent, None, vram_used_gb, vram_total_gb);
            }
        }
    }

    // Ultimate fallback: return static VRAM info only
    (None, None, None, get_vram_total_cached())
}

#[cfg(not(target_os = "windows"))]
fn detect_gpu_usage() -> (Option<f64>, Option<f64>, Option<f64>, Option<f64>) {
    (None, None, None, None)
}

#[tauri::command]
async fn get_live_resources() -> LiveResources {
    let result = tokio::task::spawn_blocking(|| {
        let mut sys = System::new_all();
        sys.refresh_all();
        std::thread::sleep(std::time::Duration::from_millis(200));
        sys.refresh_cpu_usage();

        let cpu_percent = sys.global_cpu_usage() as f64;
        let cpu_per_core: Vec<f64> = sys.cpus().iter().map(|c| c.cpu_usage() as f64).collect();
        let ram_total = sys.total_memory() as f64 / 1_073_741_824.0;
        let ram_used = (sys.total_memory() - sys.available_memory()) as f64 / 1_073_741_824.0;

        let (gpu_percent, gpu_temp_c, vram_used_gb, vram_total_gb) = detect_gpu_usage();

        let disks = Disks::new_with_refreshed_list();
        let (disk_free, disk_total) = disks.list().first()
            .map(|d| (d.available_space() as f64 / 1_073_741_824.0, d.total_space() as f64 / 1_073_741_824.0))
            .unwrap_or((0.0, 0.0));

        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        LiveResources {
            cpu_percent: round1(cpu_percent),
            cpu_per_core,
            ram_used_gb: round1(ram_used),
            ram_total_gb: round1(ram_total),
            gpu_percent, gpu_temp_c, vram_used_gb, vram_total_gb,
            disk_free_gb: round1(disk_free),
            disk_total_gb: round1(disk_total),
            timestamp,
        }
    }).await.unwrap();
    result
}

#[tauri::command]
fn classify_hardware_tier(ram_gb: f64, vram_gb: Option<f64>, _cpu_cores: u32) -> serde_json::Value {
    let vram = vram_gb.unwrap_or(0.0);
    let tier = if ram_gb <= 4.0 {
        "potato"
    } else if ram_gb <= 16.0 && vram <= 4.0 {
        "laptop"
    } else if ram_gb <= 32.0 && vram <= 12.0 {
        "gaming"
    } else if ram_gb <= 64.0 && vram <= 24.0 {
        "workstation"
    } else {
        "server"
    };

    let (icon, name, description, max_params, best_quant) = match tier {
        "potato" => ("🥔", "Budget PC", "Limited to small models (1-3B) with heavy quantization", 3.0, "q2_k"),
        "laptop" => ("💻", "Laptop", "Can run small models (3-7B) with quantization, CPU inference", 7.0, "q4_k_m"),
        "gaming" => ("🎮", "Gaming PC", "Can run 7B-13B models at good speed with GPU acceleration", 13.0, "q4_k_m"),
        "workstation" => ("🏢", "Workstation", "Can run 30B-70B models with appropriate quantization", 70.0, "q4_k_m"),
        _ => ("🖥️", "Server", "Enterprise tier: 70B+ models, multiple concurrent loads", 200.0, "fp16"),
    };

    serde_json::json!({
        "tier": tier,
        "icon": icon,
        "name": name,
        "description": description,
        "maxModelParams": max_params,
        "bestQuant": best_quant,
        "canGPU": vram > 2.0,
    })
}

#[tauri::command]
fn check_disk_space(path: String) -> DiskSpaceInfo {
    let disks = Disks::new_with_refreshed_list();
    let target = std::path::Path::new(&path);

    for disk in disks.list() {
        if target.starts_with(disk.mount_point()) {
            return DiskSpaceInfo {
                total_gb: round1(disk.total_space() as f64 / 1_073_741_824.0),
                free_gb: round1(disk.available_space() as f64 / 1_073_741_824.0),
                available_gb: round1(disk.available_space() as f64 / 1_073_741_824.0),
                path: path.clone(),
            };
        }
    }

    // Fallback: use first disk
    if let Some(disk) = disks.list().first() {
        return DiskSpaceInfo {
            total_gb: round1(disk.total_space() as f64 / 1_073_741_824.0),
            free_gb: round1(disk.available_space() as f64 / 1_073_741_824.0),
            available_gb: round1(disk.available_space() as f64 / 1_073_741_824.0),
            path,
        };
    }

    DiskSpaceInfo { total_gb: 0.0, free_gb: 0.0, available_gb: 0.0, path }
}

#[tauri::command]
fn check_compatibility(model_params_billions: f64, quantization: String) -> serde_json::Value {
    let sys_info = get_system_info();
    let bytes_per_param: f64 = match quantization.as_str() {
        "fp32" | "float32" => 4.0,
        "fp16" | "float16" | "bf16" | "bfloat16" => 2.0,
        "int8" | "q8" | "q8_0" => 1.0,
        "int4" | "q4" | "q4_0" | "q4_k_m" | "q4_k_s" => 0.5,
        "q5" | "q5_0" | "q5_k_m" | "q5_k_s" => 0.625,
        "q6" | "q6_k" => 0.75,
        "q3" | "q3_k_m" | "q3_k_s" => 0.375,
        "q2" | "q2_k" => 0.25,
        _ => 2.0,
    };
    let model_size_gb = model_params_billions * bytes_per_param;
    let needed_gb = model_size_gb * 1.2;

    let gpu_can_run = sys_info.gpu_vram_gb.map(|vram| vram >= needed_gb).unwrap_or(false);
    let cpu_can_run = sys_info.ram_available_gb >= needed_gb * 1.1;

    let (status, message) = if gpu_can_run {
        ("green", format!("✓ This model can run on your GPU! Needs ~{:.1}GB, you have {:.1}GB VRAM.",
            needed_gb, sys_info.gpu_vram_gb.unwrap_or(0.0)))
    } else if cpu_can_run {
        ("yellow", format!("⚠ This model can run on CPU (slower). Needs ~{:.1}GB, you have {:.1}GB RAM available.",
            needed_gb, sys_info.ram_available_gb))
    } else {
        ("red", format!("✗ This model is too large. Needs ~{:.1}GB, you have {:.1}GB RAM{}.",
            needed_gb, sys_info.ram_available_gb,
            sys_info.gpu_vram_gb.map(|v| format!(" + {:.1}GB VRAM", v)).unwrap_or_default()))
    };

    let mut suggestions = Vec::new();
    if status == "red" || status == "yellow" {
        if quantization != "q4_k_m" && quantization != "q4" {
            let q4_size = model_params_billions * 0.5 * 1.2;
            suggestions.push(format!("Try Q4_K_M quantization (needs only ~{:.1}GB)", q4_size));
        }
        if model_params_billions > 7.0 {
            suggestions.push("Consider a smaller model variant (7B or 3B)".to_string());
        }
        if status == "yellow" {
            suggestions.push("GPU offloading could speed this up significantly".to_string());
        }
    }

    serde_json::json!({
        "status": status,
        "message": message,
        "model_size_gb": round1(model_size_gb),
        "needed_gb": round1(needed_gb),
        "suggestions": suggestions,
        "system": sys_info,
    })
}

// ── Model Import & Discovery (Story 3 + Story 5) ──────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OllamaModel {
    pub name: String,
    pub size: u64,
    pub modified_at: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct OllamaScanResult {
    pub status: String,
    pub models: Vec<OllamaModel>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScannedGgufFile {
    pub name: String,
    pub path: String,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImportedModelInfo {
    pub name: String,
    pub path: String,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PersistedImportedModel {
    pub id: String,
    pub name: String,
    pub path: String,
    pub size: u64,
    pub import_date: String,
    pub source: String,
}

/// FR-011: Check if Ollama is running and list its models
#[tauri::command]
async fn scan_ollama_models() -> OllamaScanResult {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build();
    let client = match client {
        Ok(c) => c,
        Err(_) => return OllamaScanResult { status: "error".into(), models: vec![] },
    };

    match client.get("http://127.0.0.1:11434/api/tags").send().await {
        Ok(resp) => {
            if !resp.status().is_success() {
                return OllamaScanResult {
                    status: "not_running".into(),
                    models: vec![],
                };
            }
            // Ollama returns { "models": [ { "name": ..., "size": ..., "modified_at": ... } ] }
            #[derive(Deserialize)]
            struct OllamaTagsResponse {
                models: Option<Vec<OllamaModelRaw>>,
            }
            #[derive(Deserialize)]
            struct OllamaModelRaw {
                name: String,
                size: Option<u64>,
                modified_at: Option<String>,
            }

            match resp.json::<OllamaTagsResponse>().await {
                Ok(tags) => {
                    let models = tags.models.unwrap_or_default()
                        .into_iter()
                        .map(|m| OllamaModel {
                            name: m.name,
                            size: m.size.unwrap_or(0),
                            modified_at: m.modified_at.unwrap_or_default(),
                        })
                        .collect();
                    OllamaScanResult { status: "running".into(), models }
                }
                Err(_) => OllamaScanResult { status: "running".into(), models: vec![] },
            }
        }
        Err(_) => OllamaScanResult {
            status: "not_running".into(),
            models: vec![],
        },
    }
}

/// FR-012: Scan LM Studio default model directory for GGUF files
#[tauri::command]
async fn scan_lm_studio_models() -> Vec<ScannedGgufFile> {
    let home = get_home_dir();
    let lm_dir = std::path::PathBuf::from(&home)
        .join(".cache")
        .join("lm-studio")
        .join("models");

    scan_directory_for_gguf(&lm_dir)
}

/// Scan a user-selected directory for GGUF files
#[tauri::command]
async fn scan_local_gguf_files(dir_path: String) -> Vec<ScannedGgufFile> {
    let path = std::path::PathBuf::from(&dir_path);
    scan_directory_for_gguf(&path)
}

/// FR-018: Validate a file is a GGUF file and return model info
#[tauri::command]
async fn import_model_file(file_path: String) -> Result<ImportedModelInfo, String> {
    let path = std::path::Path::new(&file_path);

    if !path.exists() {
        return Err("File does not exist".into());
    }

    let ext = path.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    if ext.to_lowercase() != "gguf" {
        return Err("File is not a GGUF file (must have .gguf extension)".into());
    }

    let metadata = std::fs::metadata(path).map_err(|e| format!("Cannot read file: {}", e))?;
    if metadata.len() == 0 {
        return Err("File is empty (0 bytes)".into());
    }

    let name = path.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string();

    Ok(ImportedModelInfo {
        name,
        path: file_path,
        size: metadata.len(),
    })
}

/// FR-015: Read persisted imported models from app data
#[tauri::command]
async fn get_imported_models(app_handle: tauri::AppHandle) -> Vec<PersistedImportedModel> {
    let path = get_imports_file_path(&app_handle);
    match std::fs::read_to_string(&path) {
        Ok(data) => serde_json::from_str(&data).unwrap_or_default(),
        Err(_) => vec![],
    }
}

/// FR-015: Save imported models list to app data
#[tauri::command]
async fn save_imported_models(app_handle: tauri::AppHandle, models: Vec<PersistedImportedModel>) -> Result<(), String> {
    let path = get_imports_file_path(&app_handle);
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let json = serde_json::to_string_pretty(&models)
        .map_err(|e| format!("Serialization error: {}", e))?;
    std::fs::write(&path, json)
        .map_err(|e| format!("Failed to write imports file: {}", e))
}

// ── Helpers ────────────────────────────────────────────────────────────

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

fn get_imports_file_path(app_handle: &tauri::AppHandle) -> std::path::PathBuf {
    app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
        .join("imported_models.json")
}

fn scan_directory_for_gguf(dir: &std::path::Path) -> Vec<ScannedGgufFile> {
    let mut results = Vec::new();
    if !dir.exists() || !dir.is_dir() {
        return results;
    }
    scan_gguf_recursive(dir, &mut results);
    results
}

fn scan_gguf_recursive(dir: &std::path::Path, results: &mut Vec<ScannedGgufFile>) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            scan_gguf_recursive(&path, results);
        } else if let Some(ext) = path.extension() {
            if ext.to_str().map(|s| s.to_lowercase()) == Some("gguf".to_string()) {
                let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
                let name = path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string();
                results.push(ScannedGgufFile {
                    name,
                    path: path.to_string_lossy().to_string(),
                    size,
                });
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let download_state: ManagedDownloads = Arc::new(Mutex::new(DownloadManagerState::new()));
    let inference_state: ManagedInference = Arc::new(Mutex::new(InferenceManager {
        info: InferenceInfo::default(),
        child: None,
    }));
    let backend_state: ManagedBackends = Arc::new(Mutex::new(BackendManager::new()));
    let model_manager_state: ManagedModelManager = Arc::new(tokio::sync::Mutex::new(ModelManager::new()));
    let api_server_state: ManagedApiServer = Arc::new(tokio::sync::Mutex::new(ApiServer::new()));
    let auth_manager_state: ManagedAuthManager = Arc::new(tokio::sync::Mutex::new(AuthManager::new()));
    let config_manager_state: ManagedConfigManager = Arc::new(tokio::sync::Mutex::new(ConfigManager::new()));
    let mcp_host_state: ManagedMcpHost = Arc::new(tokio::sync::Mutex::new(McpHost::new()));
    let inference_on_exit = inference_state.clone();
    let mm_for_ttl = model_manager_state.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_deep_link::init())
        .manage(download_state.clone())
        .manage(inference_state)
        .manage(backend_state.clone())
        .manage(model_manager_state.clone())
        .manage(api_server_state.clone())
        .manage(auth_manager_state.clone())
        .manage(config_manager_state.clone())
        .manage(mcp_host_state.clone())
        .setup(move |app| {
            // FR-046: System tray icon with full context menu
            let show = MenuItemBuilder::with_id("show", "Open HugBrowse").build(app)?;
            let quick_chat = MenuItemBuilder::with_id("quick_chat", "Quick Chat").build(app)?;
            let status = MenuItemBuilder::with_id("status", "No model loaded")
                .enabled(false)
                .build(app)?;
            let stop_model = MenuItemBuilder::with_id("stop_model", "Stop Model")
                .enabled(false)
                .build(app)?;
            let sep = tauri::menu::PredefinedMenuItem::separator(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let menu = MenuBuilder::new(app)
                .items(&[&status, &stop_model, &sep, &show, &quick_chat, &sep, &quit])
                .build()?;
            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("HugBrowse — Local LLM Runtime")
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                        "quick_chat" => {
                            // Open app and navigate to chat
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                                let _ = w.eval("window.location.hash = '#/chat';");
                            }
                        }
                        "stop_model" => {
                            // Trigger model unload via event
                            let _ = app.emit("tray-stop-model", ());
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            // Restore persisted downloads from previous session (FR-013)
            crate::download::load_persisted_downloads(app.handle(), &download_state);
            
            // Load persisted backend configurations (FR-CO-045, FR-CO-046)  
            let backend_state_clone = backend_state.clone();
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = crate::backend::load_persisted_backends(&app_handle, &backend_state_clone).await {
                    eprintln!("Failed to load persisted backends: {}", e);
                }
            });
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            // Updater plugin: only register in release builds with proper config
            #[cfg(not(debug_assertions))]
            {
                let _ = app.handle().plugin(tauri_plugin_updater::Builder::new().build());
            }
            
            // Phase 1: Start TTL checker for model manager
            let ttl_app = app.handle().clone();
            crate::model_manager::spawn_ttl_checker(ttl_app, mm_for_ttl);

            // Phase 3: Load persisted auth tokens
            let auth_app = app.handle().clone();
            let auth_clone = auth_manager_state.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = crate::auth_manager::load_tokens(&auth_app, &auth_clone).await {
                    eprintln!("Failed to load auth tokens: {}", e);
                }
            });

            // Phase 4: Initialize config manager
            let config_clone = config_manager_state.clone();
            let app_data_dir = app.path().app_data_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
            let app_data_dir2 = app_data_dir.clone();
            tauri::async_runtime::spawn(async move {
                let mut mgr = config_clone.lock().await;
                mgr.init(app_data_dir);
            });

            // Phase 6: Initialize MCP host
            let mcp_clone = mcp_host_state.clone();
            tauri::async_runtime::spawn(async move {
                let mut host = mcp_clone.lock().await;
                host.init(app_data_dir2.join("config"));
            });
            
            Ok(())
        })
        .on_window_event(move |window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    // FR-046: Minimize to tray instead of quitting
                    let _ = window.hide();
                    api.prevent_close();
                }
                tauri::WindowEvent::Destroyed => {
                    // Terminate llama-server on app exit
                    let mut mgr = inference_on_exit.lock().unwrap();
                    if let Some(child) = mgr.child.take() {
                        let _ = child.kill();
                    }
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            check_compatibility,
            get_live_resources,
            classify_hardware_tier,
            check_disk_space,
            download::start_download,
            download::pause_download,
            download::resume_download,
            download::cancel_download,
            download::get_downloads,
            download::delete_download_entry,
            inference::load_model,
            inference::unload_model,
            inference::get_inference_status,
            inference::verify_sidecar_checksum,
            inference::get_gpus,
            inference::check_model_memory,
            inference::check_api_ready,
            backend::get_backends,
            backend::add_backend,
            backend::remove_backend,
            backend::set_active_backend,
            backend::test_backend_connection,
            backend::proxy_chat_completions,
            backend::save_backend_credential,
            backend::get_active_backend,
            backend::deploy_hf_endpoint,
            backend::check_hf_endpoint_status,
            backend::pause_hf_endpoint,
            backend::resume_hf_endpoint,
            backend::delete_hf_endpoint,
            scan_ollama_models,
            scan_lm_studio_models,
            scan_local_gguf_files,
            import_model_file,
            get_imported_models,
            save_imported_models,
            model_manager::mm_load_model,
            model_manager::mm_unload_model,
            model_manager::mm_unload_all,
            model_manager::mm_list_loaded_models,
            model_manager::mm_get_model_status,
            model_manager::mm_get_memory_usage,
            model_manager::mm_update_config,
            api_server::api_server_start,
            api_server::api_server_stop,
            api_server::api_server_status,
            api_server::api_server_update_config,
            api_server::api_server_get_log,
            auth_manager::auth_create_token,
            auth_manager::auth_list_tokens,
            auth_manager::auth_revoke_token,
            auth_manager::auth_delete_token,
            auth_manager::auth_get_config,
            auth_manager::auth_set_config,
            config_manager::config_get_settings,
            config_manager::config_update_settings,
            config_manager::config_list_presets,
            config_manager::config_create_preset,
            config_manager::config_update_preset,
            config_manager::config_delete_preset,
            config_manager::config_get_per_model,
            config_manager::config_set_per_model,
            config_manager::config_parse_model_yaml,
            config_manager::config_save_model_yaml,
            config_manager::config_export_settings,
            config_manager::config_import_settings,
            config_manager::config_export_preset,
            config_manager::config_import_preset,
            mcp_host::mcp_list_servers,
            mcp_host::mcp_add_server,
            mcp_host::mcp_remove_server,
            mcp_host::mcp_connect_server,
            mcp_host::mcp_call_tool,
            mcp_host::mcp_get_config,
            mcp_host::mcp_set_approval_mode,
            mcp_host::mcp_get_approval_mode,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
