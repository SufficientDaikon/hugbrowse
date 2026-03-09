use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};
use futures_util::StreamExt;
use sysinfo::Disks;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DownloadStatus {
    Queued,
    Downloading,
    Paused,
    Validating,
    Complete,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadEntry {
    pub id: String,
    pub model_id: String,
    pub filename: String,
    pub url: String,
    pub total_bytes: u64,
    pub downloaded_bytes: u64,
    pub status: DownloadStatus,
    pub error: Option<String>,
    pub local_path: String,
    pub speed_bps: f64,
    pub eta_secs: f64,
    pub expected_sha256: Option<String>,
    #[serde(skip_serializing, default)]
    pub auth_token: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct DownloadProgress {
    id: String,
    downloaded_bytes: u64,
    total_bytes: u64,
    speed_bps: f64,
    eta_secs: f64,
    status: DownloadStatus,
    error: Option<String>,
}

pub struct ActiveDownload {
    pub pause_flag: Arc<AtomicBool>,
    pub cancel_flag: Arc<AtomicBool>,
}

pub struct DownloadManagerState {
    pub downloads: HashMap<String, DownloadEntry>,
    pub active: HashMap<String, ActiveDownload>,
}

impl DownloadManagerState {
    pub fn new() -> Self {
        Self {
            downloads: HashMap::new(),
            active: HashMap::new(),
        }
    }
}

pub type ManagedDownloads = Arc<Mutex<DownloadManagerState>>;

fn emit_progress(app: &AppHandle, entry: &DownloadEntry) {
    let p = DownloadProgress {
        id: entry.id.clone(),
        downloaded_bytes: entry.downloaded_bytes,
        total_bytes: entry.total_bytes,
        speed_bps: entry.speed_bps,
        eta_secs: entry.eta_secs,
        status: entry.status.clone(),
        error: entry.error.clone(),
    };
    let _ = app.emit("download-progress", p);
}

/// Emit progress AND persist to disk (for terminal states: Complete, Failed, Cancelled)
fn emit_and_persist(app: &AppHandle, entry: &DownloadEntry, state: &ManagedDownloads) {
    emit_progress(app, entry);
    match entry.status {
        DownloadStatus::Complete | DownloadStatus::Failed | DownloadStatus::Cancelled => {
            persist_downloads(app, state);
        }
        _ => {}
    }
}

/// Persist download entries to a JSON file in the app data directory.
fn persist_downloads(app: &AppHandle, state: &ManagedDownloads) {
    let entries: Vec<DownloadEntry> = {
        let st = state.lock().unwrap();
        st.downloads.values().cloned().collect()
    };
    if let Ok(dir) = app.path().app_local_data_dir() {
        let file = dir.join("downloads.json");
        let _ = std::fs::create_dir_all(&dir);
        let _ = std::fs::write(&file, serde_json::to_string(&entries).unwrap_or_default());
    }
}

/// Load persisted download entries from disk. Called once at startup.
pub fn load_persisted_downloads(app: &AppHandle, state: &ManagedDownloads) {
    let dir = match app.path().app_local_data_dir() {
        Ok(d) => d,
        Err(_) => return,
    };
    let file = dir.join("downloads.json");
    let data = match std::fs::read_to_string(&file) {
        Ok(d) => d,
        Err(_) => return,
    };
    let entries: Vec<DownloadEntry> = match serde_json::from_str(&data) {
        Ok(e) => e,
        Err(_) => return,
    };
    let mut st = state.lock().unwrap();
    for mut entry in entries {
        // Mark any previously-active downloads as Paused on restore
        if entry.status == DownloadStatus::Downloading {
            entry.status = DownloadStatus::Paused;
        }
        st.downloads.insert(entry.id.clone(), entry);
    }
}

/// Check if the target disk has enough free space (1.2× file size).
fn check_disk_space_for_download(dest_dir: &str, total_bytes: u64) -> Result<(), String> {
    let disks = Disks::new_with_refreshed_list();
    let target = std::path::Path::new(dest_dir);
    let needed = (total_bytes as f64 * 1.2) as u64;

    for disk in disks.list() {
        if target.starts_with(disk.mount_point()) {
            if disk.available_space() < needed {
                let free_gb = disk.available_space() as f64 / 1_073_741_824.0;
                let need_gb = needed as f64 / 1_073_741_824.0;
                return Err(format!(
                    "Not enough disk space: {:.1} GB free, need {:.1} GB (1.2× file size)",
                    free_gb, need_gb
                ));
            }
            return Ok(());
        }
    }
    // Fallback: check first disk
    if let Some(disk) = disks.list().first() {
        if disk.available_space() < needed {
            let free_gb = disk.available_space() as f64 / 1_073_741_824.0;
            let need_gb = needed as f64 / 1_073_741_824.0;
            return Err(format!(
                "Not enough disk space: {:.1} GB free, need {:.1} GB (1.2× file size)",
                free_gb, need_gb
            ));
        }
    }
    Ok(())
}

async fn do_download(
    app: AppHandle,
    state: ManagedDownloads,
    id: String,
    url: String,
    local_path: String,
    pause_flag: Arc<AtomicBool>,
    cancel_flag: Arc<AtomicBool>,
    auth_token: Option<String>,
) {
    use tokio::io::AsyncWriteExt;

    let part_path = format!("{}.part", local_path);
    let already_downloaded = tokio::fs::metadata(&part_path)
        .await
        .map(|m| m.len())
        .unwrap_or(0);

    let client = reqwest::Client::new();
    let mut req = client.get(&url);
    if let Some(ref token) = auth_token {
        req = req.header("Authorization", format!("Bearer {}", token));
    }
    if already_downloaded > 0 {
        req = req.header("Range", format!("bytes={}-", already_downloaded));
    }

    let response = match req.send().await {
        Ok(r) if r.status().is_success() || r.status().as_u16() == 206 => r,
        Ok(r) => {
            let mut st = state.lock().unwrap();
            if let Some(e) = st.downloads.get_mut(&id) {
                e.status = DownloadStatus::Failed;
                e.error = Some(format!("HTTP {}", r.status()));
                emit_and_persist(&app, e, &state);
            }
            return;
        }
        Err(e) => {
            let mut st = state.lock().unwrap();
            if let Some(entry) = st.downloads.get_mut(&id) {
                entry.status = DownloadStatus::Failed;
                entry.error = Some(e.to_string());
                emit_and_persist(&app, entry, &state);
            }
            return;
        }
    };

    let content_length = response.content_length().unwrap_or(0);
    {
        let mut st = state.lock().unwrap();
        if let Some(e) = st.downloads.get_mut(&id) {
            if e.total_bytes == 0 {
                e.total_bytes = already_downloaded + content_length;
            }
        }
    }

    let mut file = match if already_downloaded > 0 {
        tokio::fs::OpenOptions::new()
            .write(true)
            .append(true)
            .open(&part_path)
            .await
    } else {
        tokio::fs::File::create(&part_path)
            .await
            .map(tokio::fs::File::from)
    } {
        Ok(f) => f,
        Err(e) => {
            let mut st = state.lock().unwrap();
            if let Some(entry) = st.downloads.get_mut(&id) {
                entry.status = DownloadStatus::Failed;
                entry.error = Some(format!("File open error: {}", e));
                emit_and_persist(&app, entry, &state);
            }
            return;
        }
    };

    let mut downloaded = already_downloaded;
    let mut stream = response.bytes_stream();
    let mut speed_timer = Instant::now();
    let mut bytes_since_tick: u64 = 0;

    while let Some(chunk_result) = stream.next().await {
        if cancel_flag.load(Ordering::Relaxed) {
            {
                let mut st = state.lock().unwrap();
                if let Some(e) = st.downloads.get_mut(&id) {
                    e.status = DownloadStatus::Cancelled;
                    emit_and_persist(&app, e, &state);
                }
            }
            drop(file);
            let _ = tokio::fs::remove_file(&part_path).await;
            return;
        }

        if pause_flag.load(Ordering::Relaxed) {
            {
                let mut st = state.lock().unwrap();
                if let Some(e) = st.downloads.get_mut(&id) {
                    e.status = DownloadStatus::Paused;
                    e.downloaded_bytes = downloaded;
                    emit_progress(&app, e);
                }
            }
            loop {
                tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                if cancel_flag.load(Ordering::Relaxed) {
                    return;
                }
                if !pause_flag.load(Ordering::Relaxed) {
                    break;
                }
            }
            {
                let mut st = state.lock().unwrap();
                if let Some(e) = st.downloads.get_mut(&id) {
                    e.status = DownloadStatus::Downloading;
                }
            }
        }

        match chunk_result {
            Ok(chunk) => {
                downloaded += chunk.len() as u64;
                bytes_since_tick += chunk.len() as u64;
                if let Err(e) = file.write_all(&chunk).await {
                    let mut st = state.lock().unwrap();
                    if let Some(entry) = st.downloads.get_mut(&id) {
                        entry.status = DownloadStatus::Failed;
                        entry.error = Some(format!("Write error: {}", e));
                        emit_and_persist(&app, entry, &state);
                    }
                    return;
                }
                let elapsed = speed_timer.elapsed();
                if elapsed.as_millis() >= 500 {
                    let speed = bytes_since_tick as f64 / elapsed.as_secs_f64();
                    let mut st = state.lock().unwrap();
                    if let Some(e) = st.downloads.get_mut(&id) {
                        let remaining = e.total_bytes.saturating_sub(downloaded);
                        e.downloaded_bytes = downloaded;
                        e.speed_bps = speed;
                        e.eta_secs = if speed > 0.0 { remaining as f64 / speed } else { 0.0 };
                        emit_progress(&app, e);
                    }
                    speed_timer = Instant::now();
                    bytes_since_tick = 0;
                }
            }
            Err(e) => {
                let mut st = state.lock().unwrap();
                if let Some(entry) = st.downloads.get_mut(&id) {
                    entry.status = DownloadStatus::Failed;
                    entry.error = Some(format!("Network error: {}", e));
                    emit_and_persist(&app, entry, &state);
                }
                return;
            }
        }
    }

    let _ = file.flush().await;
    drop(file);

    // SHA-256 validation
    let expected = {
        let st = state.lock().unwrap();
        st.downloads.get(&id).and_then(|e| e.expected_sha256.clone())
    };

    if let Some(expected_hash) = expected {
        {
            let mut st = state.lock().unwrap();
            if let Some(e) = st.downloads.get_mut(&id) {
                e.status = DownloadStatus::Validating;
                emit_progress(&app, e);
            }
        }
        let part_clone = part_path.clone();
        let actual = tokio::task::spawn_blocking(move || {
            use sha2::{Digest, Sha256};
            use std::io::Read;
            let mut file = std::fs::File::open(&part_clone)?;
            let mut h = Sha256::new();
            let mut buf = [0u8; 65536];
            loop {
                let n = file.read(&mut buf)?;
                if n == 0 { break; }
                h.update(&buf[..n]);
            }
            Ok::<String, std::io::Error>(hex::encode(h.finalize()))
        })
        .await;
        match actual {
            Ok(Ok(hash)) if hash == expected_hash => {}
            Ok(Ok(hash)) => {
                {
                    let mut st = state.lock().unwrap();
                    if let Some(e) = st.downloads.get_mut(&id) {
                        e.status = DownloadStatus::Failed;
                        e.error = Some(format!("SHA-256 mismatch: expected {expected_hash}, got {hash}"));
                        emit_and_persist(&app, e, &state);
                    }
                }
                let _ = tokio::fs::remove_file(&part_path).await;
                return;
            }
            _ => {
                let mut st = state.lock().unwrap();
                if let Some(e) = st.downloads.get_mut(&id) {
                    e.status = DownloadStatus::Failed;
                    e.error = Some("SHA-256 validation failed".into());
                    emit_and_persist(&app, e, &state);
                }
                return;
            }
        }
    }

    if let Err(e) = tokio::fs::rename(&part_path, &local_path).await {
        let mut st = state.lock().unwrap();
        if let Some(entry) = st.downloads.get_mut(&id) {
            entry.status = DownloadStatus::Failed;
            entry.error = Some(format!("Cannot finalize: {}", e));
            emit_and_persist(&app, entry, &state);
        }
        return;
    }

    let mut st = state.lock().unwrap();
    if let Some(e) = st.downloads.get_mut(&id) {
        e.status = DownloadStatus::Complete;
        e.downloaded_bytes = downloaded;
        e.speed_bps = 0.0;
        e.eta_secs = 0.0;
        emit_progress(&app, e);
    }
    st.active.remove(&id);
    drop(st);
    persist_downloads(&app, &state);
}

#[tauri::command]
pub async fn start_download(
    app: AppHandle,
    state: State<'_, ManagedDownloads>,
    url: String,
    model_id: String,
    filename: String,
    dest_dir: String,
    total_bytes: u64,
    expected_sha256: Option<String>,
    auth_token: Option<String>,
) -> Result<String, String> {
    // Enforce disk space: reject if free < 1.2× file size (FR-011)
    check_disk_space_for_download(&dest_dir, total_bytes)?;

    std::fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let local_path = format!("{}/{}", dest_dir.trim_end_matches('/'), filename);
    let pause_flag = Arc::new(AtomicBool::new(false));
    let cancel_flag = Arc::new(AtomicBool::new(false));

    let entry = DownloadEntry {
        id: id.clone(),
        model_id,
        filename,
        url: url.clone(),
        total_bytes,
        downloaded_bytes: 0,
        status: DownloadStatus::Downloading,
        error: None,
        local_path: local_path.clone(),
        speed_bps: 0.0,
        eta_secs: 0.0,
        expected_sha256,
        auth_token: auth_token.clone(),
    };

    {
        let mut st = state.lock().unwrap();
        st.downloads.insert(id.clone(), entry);
        st.active.insert(
            id.clone(),
            ActiveDownload {
                pause_flag: pause_flag.clone(),
                cancel_flag: cancel_flag.clone(),
            },
        );
    }
    persist_downloads(&app, &state);

    let app2 = app.clone();
    let state2 = state.inner().clone();
    let id2 = id.clone();
    tokio::spawn(do_download(app2, state2, id2, url, local_path, pause_flag, cancel_flag, auth_token));
    Ok(id)
}

#[tauri::command]
pub fn pause_download(state: State<'_, ManagedDownloads>, id: String) -> Result<(), String> {
    let st = state.lock().unwrap();
    match st.active.get(&id) {
        Some(a) => {
            a.pause_flag.store(true, Ordering::Relaxed);
            Ok(())
        }
        None => Err(format!("Download {id} not active")),
    }
}

#[tauri::command]
pub fn resume_download(state: State<'_, ManagedDownloads>, id: String) -> Result<(), String> {
    let st = state.lock().unwrap();
    match st.active.get(&id) {
        Some(a) => {
            a.pause_flag.store(false, Ordering::Relaxed);
            Ok(())
        }
        None => Err(format!("Download {id} not active")),
    }
}

#[tauri::command]
pub fn cancel_download(state: State<'_, ManagedDownloads>, id: String) -> Result<(), String> {
    let mut st = state.lock().unwrap();
    if let Some(a) = st.active.get(&id) {
        a.cancel_flag.store(true, Ordering::Relaxed);
        a.pause_flag.store(false, Ordering::Relaxed);
    }
    st.downloads.remove(&id);
    st.active.remove(&id);
    Ok(())
}

#[tauri::command]
pub fn get_downloads(state: State<'_, ManagedDownloads>) -> Vec<DownloadEntry> {
    let mut st = state.lock().unwrap();
    // EC-004: Detect externally deleted files — mark completed downloads as missing
    for entry in st.downloads.values_mut() {
        if entry.status == DownloadStatus::Complete {
            if !std::path::Path::new(&entry.local_path).exists() {
                entry.status = DownloadStatus::Failed;
                entry.error = Some("Model file was deleted externally".into());
            }
        }
    }
    st.downloads.values().cloned().collect()
}

#[tauri::command]
pub fn delete_download_entry(
    state: State<'_, ManagedDownloads>,
    id: String,
    delete_file: bool,
) -> Result<(), String> {
    let mut st = state.lock().unwrap();
    if let Some(e) = st.downloads.remove(&id) {
        if let Some(a) = st.active.remove(&id) {
            a.cancel_flag.store(true, Ordering::Relaxed);
        }
        if delete_file {
            let _ = std::fs::remove_file(&e.local_path);
            let _ = std::fs::remove_file(format!("{}.part", e.local_path));
        }
    }
    Ok(())
}
