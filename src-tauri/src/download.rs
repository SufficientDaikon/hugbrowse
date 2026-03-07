use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use futures_util::StreamExt;

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

async fn do_download(
    app: AppHandle,
    state: ManagedDownloads,
    id: String,
    url: String,
    local_path: String,
    pause_flag: Arc<AtomicBool>,
    cancel_flag: Arc<AtomicBool>,
) {
    use tokio::io::AsyncWriteExt;

    let part_path = format!("{}.part", local_path);
    let already_downloaded = tokio::fs::metadata(&part_path)
        .await
        .map(|m| m.len())
        .unwrap_or(0);

    let client = reqwest::Client::new();
    let mut req = client.get(&url);
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
                emit_progress(&app, e);
            }
            return;
        }
        Err(e) => {
            let mut st = state.lock().unwrap();
            if let Some(entry) = st.downloads.get_mut(&id) {
                entry.status = DownloadStatus::Failed;
                entry.error = Some(e.to_string());
                emit_progress(&app, entry);
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
                emit_progress(&app, entry);
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
            let mut st = state.lock().unwrap();
            if let Some(e) = st.downloads.get_mut(&id) {
                e.status = DownloadStatus::Cancelled;
                emit_progress(&app, e);
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
                        emit_progress(&app, entry);
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
                    emit_progress(&app, entry);
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
            let data = std::fs::read(&part_clone)?;
            let mut h = Sha256::new();
            h.update(&data);
            Ok::<String, std::io::Error>(hex::encode(h.finalize()))
        })
        .await;
        match actual {
            Ok(Ok(hash)) if hash == expected_hash => {}
            Ok(Ok(hash)) => {
                let mut st = state.lock().unwrap();
                if let Some(e) = st.downloads.get_mut(&id) {
                    e.status = DownloadStatus::Failed;
                    e.error = Some(format!("SHA-256 mismatch: expected {expected_hash}, got {hash}"));
                    emit_progress(&app, e);
                }
                let _ = tokio::fs::remove_file(&part_path).await;
                return;
            }
            _ => {
                let mut st = state.lock().unwrap();
                if let Some(e) = st.downloads.get_mut(&id) {
                    e.status = DownloadStatus::Failed;
                    e.error = Some("SHA-256 validation failed".into());
                    emit_progress(&app, e);
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
            emit_progress(&app, entry);
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
) -> Result<String, String> {
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

    let app2 = app.clone();
    let state2 = state.inner().clone();
    let id2 = id.clone();
    tokio::spawn(do_download(app2, state2, id2, url, local_path, pause_flag, cancel_flag));
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
    let st = state.lock().unwrap();
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
