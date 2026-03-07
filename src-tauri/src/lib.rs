use serde::Serialize;
use sysinfo::{System, Disks};
use crate::download::{ManagedDownloads, DownloadManagerState};
use crate::inference::{ManagedInference, InferenceManager, InferenceInfo};
use std::sync::{Arc, Mutex};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::Manager;

pub mod download;
pub mod inference;

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

#[cfg(target_os = "windows")]
fn detect_gpu_usage() -> (Option<f64>, Option<f64>, Option<f64>, Option<f64>) {
    use std::process::Command;
    // Try nvidia-smi for NVIDIA GPUs
    if let Ok(output) = Command::new("nvidia-smi")
        .args(["--query-gpu=utilization.gpu,temperature.gpu,memory.used,memory.total", "--format=csv,noheader,nounits"])
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
    (None, None, None, None)
}

#[cfg(not(target_os = "windows"))]
fn detect_gpu_usage() -> (Option<f64>, Option<f64>, Option<f64>, Option<f64>) {
    (None, None, None, None)
}

#[tauri::command]
fn get_live_resources() -> LiveResources {
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
}

#[tauri::command]
fn classify_hardware_tier(ram_gb: f64, vram_gb: Option<f64>, cpu_cores: u32) -> serde_json::Value {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let download_state: ManagedDownloads = Arc::new(Mutex::new(DownloadManagerState::new()));
    let inference_state: ManagedInference = Arc::new(Mutex::new(InferenceManager {
        info: InferenceInfo::default(),
        child: None,
    }));
    let inference_on_exit = inference_state.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .manage(download_state.clone())
        .manage(inference_state)
        .setup(move |app| {
            // FR-046: System tray icon
            let show = MenuItemBuilder::with_id("show", "Show HugBrowse").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let menu = MenuBuilder::new(app).items(&[&show, &quit]).build()?;
            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("HugBrowse")
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
