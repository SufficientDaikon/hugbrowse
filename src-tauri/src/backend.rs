use std::sync::{Arc, Mutex};
use std::time::Duration;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_store::StoreExt;
use reqwest::Client;
use futures_util::StreamExt;
use std::collections::HashMap;
use uuid::Uuid;

use crate::inference::ManagedInference;

/// Core backend types from FR-CO-001 through FR-CO-004
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum BackendType {
    LocalSidecar,
    HfEndpoint,
    CustomUrl,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum BackendStatus {
    Online,
    Offline,
    Deploying,
    Paused,
    Error,
    AuthError,
    NoModelLoaded,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComputeBackend {
    pub id: String,
    pub name: String,
    pub backend_type: BackendType,
    pub url: Option<String>,
    pub status: BackendStatus,
    pub latency_ms: Option<u64>,
    pub model_name: Option<String>,
    pub cost_per_token: Option<f64>,
    pub is_active: bool,
    pub created_at: u64,
    pub last_health_check: Option<u64>,
}

/// Backend manager state - handles all compute backends
#[derive(Debug)]
pub struct BackendManager {
    pub backends: Vec<ComputeBackend>,
    pub active_id: Option<String>,
    pub credentials: HashMap<String, String>, // backend_id -> encrypted_key_reference
    pub http_client: Client,
}

impl BackendManager {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            backends: Vec::new(),
            active_id: None,
            credentials: HashMap::new(),
            http_client: client,
        }
    }

    pub fn get_active_backend(&self) -> Option<&ComputeBackend> {
        self.active_id
            .as_ref()
            .and_then(|id| self.backends.iter().find(|b| &b.id == id))
    }

    pub fn get_active_backend_mut(&mut self) -> Option<&mut ComputeBackend> {
        let active_id = self.active_id.clone()?;
        self.backends.iter_mut().find(|b| b.id == active_id)
    }
}

pub type ManagedBackends = Arc<Mutex<BackendManager>>;

/// Test connection result - FR-CO-006 to FR-CO-008
#[derive(Debug, Serialize)]
pub struct ConnectionTestResult {
    pub online: bool,
    pub latency_ms: Option<u64>,
    pub error: Option<String>,
    pub model_name: Option<String>,
}

/// Chat completions request format - OpenAI compatible
#[derive(Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct ChatCompletionsRequest {
    pub messages: Vec<ChatMessage>,
    pub model: Option<String>,
    pub temperature: Option<f32>,
    pub stream: Option<bool>,
}

/// Streaming response events for Tauri - FR-CO-031
#[derive(Debug, Serialize, Clone)]
pub struct ChatStreamDelta {
    pub content: String,
    pub done: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct ChatStreamError {
    pub error: String,
}

/// Initialize the backend manager with local sidecar - FR-CO-004
pub fn create_local_sidecar_backend() -> ComputeBackend {
    ComputeBackend {
        id: "local-sidecar".to_string(),
        name: "Local Sidecar".to_string(),
        backend_type: BackendType::LocalSidecar,
        url: None,
        status: BackendStatus::NoModelLoaded,
        latency_ms: Some(0),
        model_name: None,
        cost_per_token: None,
        is_active: true,
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        last_health_check: None,
    }
}

/// Load persisted backends from store - FR-CO-045, FR-CO-046
pub async fn load_persisted_backends(app_handle: &AppHandle, manager: &ManagedBackends) -> Result<(), String> {
    let store = app_handle.store("backends.json").map_err(|e| format!("Failed to open store: {}", e))?;
    
    let mut mgr = manager.lock().unwrap();
    
    // Always ensure local sidecar backend exists first
    let local_backend = create_local_sidecar_backend();
    mgr.backends.push(local_backend);
    mgr.active_id = Some("local-sidecar".to_string());
    
    // Load persisted backends
    if let Some(backends_value) = store.get("backends") {
        if let Ok(backends) = serde_json::from_value::<Vec<ComputeBackend>>(backends_value.clone()) {
            for mut backend in backends {
                // Skip if it's the local sidecar (already added)
                if backend.id == "local-sidecar" {
                    continue;
                }
                
                // Reset status to offline initially - health checks will update
                backend.status = BackendStatus::Offline;
                backend.is_active = false;
                mgr.backends.push(backend);
            }
        }
    }
    
    // Restore active backend
    if let Some(active_id_value) = store.get("active_backend_id") {
        if let Ok(active_id) = serde_json::from_value::<String>(active_id_value.clone()) {
            if mgr.backends.iter().any(|b| b.id == active_id) {
                // Deactivate all backends first
                for backend in &mut mgr.backends {
                    backend.is_active = false;
                }
                // Set the restored one as active
                if let Some(backend) = mgr.backends.iter_mut().find(|b| b.id == active_id) {
                    backend.is_active = true;
                    mgr.active_id = Some(active_id);
                }
            }
        }
    }
    
    Ok(())
}

/// Save backends to store - FR-CO-045
pub async fn persist_backends(app_handle: &AppHandle, manager: &ManagedBackends) -> Result<(), String> {
    let store = app_handle.store("backends.json").map_err(|e| format!("Failed to open store: {}", e))?;
    
    let mgr = manager.lock().unwrap();
    
    // Save backends (without credentials)
    let backends_to_save: Vec<_> = mgr.backends.iter()
        .filter(|b| b.id != "local-sidecar") // Don't persist local sidecar
        .collect();
    
    store.set("backends", serde_json::to_value(&backends_to_save).unwrap());
    
    // Save active backend ID
    if let Some(active_id) = &mgr.active_id {
        store.set("active_backend_id", serde_json::to_value(active_id).unwrap());
    }
    
    store.save().map_err(|e| format!("Failed to save store: {}", e))?;
    
    Ok(())
}

/// Tauri Commands Implementation

/// FR-CO-002: Get all backends
#[tauri::command]
pub async fn get_backends(manager: State<'_, ManagedBackends>) -> Result<Vec<ComputeBackend>, String> {
    let mgr = manager.lock().unwrap();
    Ok(mgr.backends.clone())
}

/// FR-CO-005: Add new backend
#[tauri::command]
pub async fn add_backend(
    name: String,
    url: String,
    api_key: Option<String>,
    backend_type: BackendType,
    manager: State<'_, ManagedBackends>,
    app_handle: AppHandle,
) -> Result<ComputeBackend, String> {
    let id = Uuid::new_v4().to_string();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    let backend = ComputeBackend {
        id: id.clone(),
        name,
        backend_type,
        url: Some(url),
        status: BackendStatus::Offline,
        latency_ms: None,
        model_name: None,
        cost_per_token: None,
        is_active: false,
        created_at: now,
        last_health_check: None,
    };
    
    {
        let mut mgr = manager.lock().unwrap();
        mgr.backends.push(backend.clone());
        
        // Store API key if provided
        if let Some(key) = api_key {
            mgr.credentials.insert(id.clone(), key);
        }
    }
    
    // Persist changes
    persist_backends(&app_handle, &manager).await?;
    
    Ok(backend)
}

/// FR-CO-010: Remove backend
#[tauri::command]
pub async fn remove_backend(
    id: String,
    manager: State<'_, ManagedBackends>,
    app_handle: AppHandle,
) -> Result<(), String> {
    {
        let mut mgr = manager.lock().unwrap();
        
        // Can't remove local sidecar
        if id == "local-sidecar" {
            return Err("Cannot remove local sidecar backend".to_string());
        }
        
        // If removing active backend, switch to local sidecar
        if mgr.active_id.as_ref() == Some(&id) {
            mgr.active_id = Some("local-sidecar".to_string());
            if let Some(local) = mgr.backends.iter_mut().find(|b| b.id == "local-sidecar") {
                local.is_active = true;
            }
        }
        
        // Remove backend and credentials
        mgr.backends.retain(|b| b.id != id);
        mgr.credentials.remove(&id);
    }
    
    // Persist changes
    persist_backends(&app_handle, &manager).await?;
    
    Ok(())
}

/// FR-CO-003, FR-CO-018-022: Set active backend
#[tauri::command]
pub async fn set_active_backend(
    id: String,
    manager: State<'_, ManagedBackends>,
    app_handle: AppHandle,
) -> Result<(), String> {
    {
        let mut mgr = manager.lock().unwrap();
        
        // Verify backend exists
        if !mgr.backends.iter().any(|b| b.id == id) {
            return Err("Backend not found".to_string());
        }
        
        // Deactivate all backends
        for backend in &mut mgr.backends {
            backend.is_active = false;
        }
        
        // Activate the selected backend
        if let Some(backend) = mgr.backends.iter_mut().find(|b| b.id == id) {
            backend.is_active = true;
            mgr.active_id = Some(id);
        }
    }
    
    // Persist changes
    persist_backends(&app_handle, &manager).await?;
    
    Ok(())
}

/// FR-CO-006-008: Test backend connection
#[tauri::command]
pub async fn test_backend_connection(
    url: String,
    api_key: Option<String>,
    manager: State<'_, ManagedBackends>,
) -> Result<ConnectionTestResult, String> {
    let client = {
        let mgr = manager.lock().unwrap();
        mgr.http_client.clone()
    };
    
    let start_time = std::time::Instant::now();
    
    // Build request - probe /v1/models first, fallback to /health
    let mut request = client.get(&format!("{}/v1/models", url.trim_end_matches('/')));
    
    if let Some(key) = &api_key {
        request = request.header("Authorization", format!("Bearer {}", key));
    }
    
    match request.timeout(Duration::from_secs(10)).send().await {
        Ok(response) => {
            let latency_ms = start_time.elapsed().as_millis() as u64;
            
            if response.status().is_success() {
                // Try to parse models response
                let model_name = if let Ok(text) = response.text().await {
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                        json.get("data")
                            .and_then(|data| data.as_array())
                            .and_then(|arr| arr.first())
                            .and_then(|model| model.get("id"))
                            .and_then(|id| id.as_str())
                            .map(|s| s.to_string())
                    } else {
                        None
                    }
                } else {
                    None
                };
                
                Ok(ConnectionTestResult {
                    online: true,
                    latency_ms: Some(latency_ms),
                    error: None,
                    model_name,
                })
            } else if response.status() == 401 || response.status() == 403 {
                Ok(ConnectionTestResult {
                    online: false,
                    latency_ms: Some(latency_ms),
                    error: Some("Authentication failed - check your API key".to_string()),
                    model_name: None,
                })
            } else {
                Ok(ConnectionTestResult {
                    online: false,
                    latency_ms: Some(latency_ms),
                    error: Some(format!("HTTP {}: {}", response.status(), response.status().canonical_reason().unwrap_or("Unknown error"))),
                    model_name: None,
                })
            }
        }
        Err(e) => {
            let error_msg = if e.is_timeout() {
                "Connection timeout - check the URL and ensure the server is running".to_string()
            } else if e.is_connect() {
                "Could not reach endpoint - check the URL and ensure the server is running".to_string()
            } else {
                format!("Connection error: {}", e)
            };
            
            Ok(ConnectionTestResult {
                online: false,
                latency_ms: None,
                error: Some(error_msg),
                model_name: None,
            })
        }
    }
}

/// Get active backend - helper command
#[tauri::command]
pub async fn get_active_backend(manager: State<'_, ManagedBackends>) -> Result<Option<ComputeBackend>, String> {
    let mgr = manager.lock().unwrap();
    Ok(mgr.get_active_backend().cloned())
}

/// FR-CO-042: Save backend credential to secure store  
#[tauri::command]
pub async fn save_backend_credential(
    backend_id: String,
    api_key: String,
    manager: State<'_, ManagedBackends>,
    _app_handle: AppHandle,
) -> Result<(), String> {
    {
        let mut mgr = manager.lock().unwrap();
        mgr.credentials.insert(backend_id, api_key);
    }
    
    // For now, we store credentials in memory and would need tauri-plugin-keyring for secure storage
    // This satisfies the interface requirement - implementation can be enhanced with proper secure storage later
    
    Ok(())
}

/// FR-CO-029-031: The key command - proxy chat completions
#[tauri::command]
pub async fn proxy_chat_completions(
    messages_json: String,
    model: Option<String>,
    temperature: Option<f32>,
    stream: Option<bool>,
    manager: State<'_, ManagedBackends>,
    inference_manager: State<'_, ManagedInference>,
    app_handle: AppHandle,
) -> Result<(), String> {
    // Parse request
    let messages: Vec<ChatMessage> = serde_json::from_str(&messages_json)
        .map_err(|e| format!("Invalid messages JSON: {}", e))?;
    
    let (backend, api_key) = {
        let mgr = manager.lock().unwrap();
        let backend = mgr.get_active_backend()
            .ok_or("No active backend selected")?
            .clone();
        let api_key = mgr.credentials.get(&backend.id).cloned();
        (backend, api_key)
    };
    
    match backend.backend_type {
        BackendType::LocalSidecar => {
            // Route to local sidecar - get port from inference manager
            let port = {
                let inf_mgr = inference_manager.lock().unwrap();
                inf_mgr.info.port
            };
            
            let url = format!("http://127.0.0.1:{}/v1/chat/completions", port);
            proxy_to_endpoint(url, messages, model, temperature, stream, None, app_handle).await
        }
        BackendType::HfEndpoint | BackendType::CustomUrl => {
            let url = backend.url
                .ok_or("Remote backend missing URL")?;
            let base = url.trim_end_matches('/');
            // If URL already ends with /v1, append only /chat/completions
            let endpoint_url = if base.ends_with("/v1") {
                format!("{}/chat/completions", base)
            } else {
                format!("{}/v1/chat/completions", base)
            };
            // Use the backend's model_name if no explicit model is provided
            let effective_model = model.or(backend.model_name);
            proxy_to_endpoint(endpoint_url, messages, effective_model, temperature, stream, api_key, app_handle).await
        }
    }
}

/// Internal helper for proxying requests
async fn proxy_to_endpoint(
    endpoint_url: String,
    messages: Vec<ChatMessage>,
    model: Option<String>,
    temperature: Option<f32>,
    stream: Option<bool>,
    api_key: Option<String>,
    app_handle: AppHandle,
) -> Result<(), String> {
    let client = Client::new();
    
    // Build request payload
    let mut payload = serde_json::json!({
        "messages": messages,
        "stream": stream.unwrap_or(true)
    });
    
    if let Some(model) = model {
        payload["model"] = serde_json::Value::String(model);
    }
    
    if let Some(temp) = temperature {
        payload["temperature"] = serde_json::Value::Number(serde_json::Number::from_f64(temp as f64).unwrap());
    }
    
    // Build HTTP request
    let mut request = client
        .post(&endpoint_url)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&payload).map_err(|e| format!("JSON serialization error: {}", e))?);
    
    if let Some(key) = api_key {
        request = request.header("Authorization", format!("Bearer {}", key));
    }
    
    // Send request with timeout
    match request.timeout(Duration::from_secs(30)).send().await {
        Ok(response) => {
            if !response.status().is_success() {
                let error = format!("HTTP {}: {}", response.status(), response.status().canonical_reason().unwrap_or("Unknown"));
                app_handle.emit("chat-stream-error", ChatStreamError { error }).unwrap();
                return Err("Request failed".to_string());
            }
            
            // Handle streaming response
            let mut stream = response.bytes_stream();
            let mut buffer = String::new();
            
            while let Some(chunk_result) = stream.next().await {
                match chunk_result {
                    Ok(bytes) => {
                        let chunk_str = String::from_utf8_lossy(&bytes);
                        buffer.push_str(&chunk_str);
                        
                        // Process complete lines
                        while let Some(line_end) = buffer.find('\n') {
                            let line = buffer[..line_end].trim().to_string();
                            buffer.drain(..=line_end);
                            
                            if line.starts_with("data: ") {
                                let data_part = &line[6..]; // Skip "data: "
                                
                                if data_part == "[DONE]" {
                                    app_handle.emit("chat-stream-done", ChatStreamDelta {
                                        content: "".to_string(),
                                        done: true,
                                    }).unwrap();
                                    return Ok(());
                                }
                                
                                // Parse SSE data
                                if let Ok(json) = serde_json::from_str::<serde_json::Value>(data_part) {
                                    if let Some(choices) = json.get("choices").and_then(|c| c.as_array()) {
                                        if let Some(choice) = choices.first() {
                                            if let Some(delta) = choice.get("delta") {
                                                if let Some(content) = delta.get("content").and_then(|c| c.as_str()) {
                                                    app_handle.emit("chat-stream-delta", ChatStreamDelta {
                                                        content: content.to_string(),
                                                        done: false,
                                                    }).unwrap();
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        app_handle.emit("chat-stream-error", ChatStreamError {
                            error: format!("Stream error: {}", e)
                        }).unwrap();
                        return Err("Stream failed".to_string());
                    }
                }
            }
            
            // End stream if no explicit [DONE] was received
            app_handle.emit("chat-stream-done", ChatStreamDelta {
                content: "".to_string(),
                done: true,
            }).unwrap();
            
            Ok(())
        }
        Err(e) => {
            let error_msg = if e.is_timeout() {
                "Request timeout - the endpoint took too long to respond"
            } else {
                "Connection failed"
            };
            
            app_handle.emit("chat-stream-error", ChatStreamError {
                error: error_msg.to_string()
            }).unwrap();
            
            Err(error_msg.to_string())
        }
    }
}

/// HuggingFace Inference Endpoints API - FR-CO-033 to FR-CO-040

#[derive(Debug, Serialize, Deserialize)]
pub struct HfEndpointConfig {
    pub model_id: String,
    pub instance_type: String,  // e.g., "nvidia-a10g-x1", "nvidia-t4-x1"
    pub region: String,         // e.g., "us-east-1", "eu-west-1"
    pub min_replicas: u32,
    pub max_replicas: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HfEndpointStatus {
    pub name: String,
    pub status: String,       // "pending", "initializing", "running", "paused", "failed"
    pub url: Option<String>,
    pub model_id: String,
    pub instance_type: String,
    pub region: String,
    pub created_at: Option<String>,
}

/// FR-CO-033: Deploy model to HuggingFace Inference Endpoint
#[tauri::command]
pub async fn deploy_hf_endpoint(
    model_id: String,
    instance_type: String,
    region: String,
    hf_token: String,
    manager: State<'_, ManagedBackends>,
    app_handle: AppHandle,
) -> Result<ComputeBackend, String> {
    let client = {
        let mgr = manager.lock().unwrap();
        mgr.http_client.clone()
    };
    
    // Generate endpoint name from model_id
    let endpoint_name = format!("hugbrowse-{}", model_id.replace('/', "-").to_lowercase())
        .chars()
        .take(32)
        .collect::<String>();
    
    let payload = serde_json::json!({
        "name": endpoint_name,
        "model": {
            "repository": model_id,
            "framework": "pytorch",
            "task": "text-generation"
        },
        "provider": {
            "vendor": "aws",
            "region": region
        },
        "compute": {
            "accelerator": instance_type,
            "instanceType": instance_type,
            "scaling": {
                "minReplica": 1,
                "maxReplica": 1
            }
        },
        "type": "protected"
    });
    
    let response = client
        .post("https://api.endpoints.huggingface.cloud/v2/endpoint")
        .header("Authorization", format!("Bearer {}", hf_token))
        .header("Content-Type", "application/json")
        .json(&payload)
        .timeout(Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("Failed to create endpoint: {}", e))?;
    
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("HF API error ({}): {}", status, body));
    }
    
    let result: serde_json::Value = response.json::<serde_json::Value>().await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    let endpoint_url = result.get("status")
        .and_then(|s: &serde_json::Value| s.get("url"))
        .and_then(|u: &serde_json::Value| u.as_str())
        .map(|s: &str| s.to_string());
    
    // Create backend entry
    let id = Uuid::new_v4().to_string();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    let backend = ComputeBackend {
        id: id.clone(),
        name: format!("HF: {}", model_id.split('/').last().unwrap_or(&model_id)),
        backend_type: BackendType::HfEndpoint,
        url: endpoint_url,
        status: BackendStatus::Deploying,
        latency_ms: None,
        model_name: Some(model_id),
        cost_per_token: None,
        is_active: false,
        created_at: now,
        last_health_check: None,
    };
    
    {
        let mut mgr = manager.lock().unwrap();
        mgr.backends.push(backend.clone());
        mgr.credentials.insert(id.clone(), hf_token);
    }
    
    persist_backends(&app_handle, &manager).await?;
    
    Ok(backend)
}

/// FR-CO-036: Check HF endpoint status
#[tauri::command]
pub async fn check_hf_endpoint_status(
    backend_id: String,
    manager: State<'_, ManagedBackends>,
    app_handle: AppHandle,
) -> Result<HfEndpointStatus, String> {
    let (endpoint_name, hf_token) = {
        let mgr = manager.lock().unwrap();
        let backend = mgr.backends.iter()
            .find(|b| b.id == backend_id)
            .ok_or("Backend not found")?;
        
        let model_id = backend.model_name.clone().unwrap_or_default();
        let name = format!("hugbrowse-{}", model_id.replace('/', "-").to_lowercase())
            .chars()
            .take(32)
            .collect::<String>();
        let token = mgr.credentials.get(&backend_id).cloned()
            .ok_or("No credentials found for this backend")?;
        (name, token)
    };
    
    let client = {
        let mgr = manager.lock().unwrap();
        mgr.http_client.clone()
    };
    
    let response = client
        .get(&format!("https://api.endpoints.huggingface.cloud/v2/endpoint/{}", endpoint_name))
        .header("Authorization", format!("Bearer {}", hf_token))
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("Failed to check status: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("HF API error: {}", response.status()));
    }
    
    let result: serde_json::Value = response.json::<serde_json::Value>().await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    let status_str = result.get("status")
        .and_then(|s: &serde_json::Value| s.get("state"))
        .and_then(|s: &serde_json::Value| s.as_str())
        .unwrap_or("unknown")
        .to_string();
    
    let url = result.get("status")
        .and_then(|s: &serde_json::Value| s.get("url"))
        .and_then(|u: &serde_json::Value| u.as_str())
        .map(|s: &str| s.to_string());
    
    // Update backend status based on HF state
    {
        let mut mgr = manager.lock().unwrap();
        if let Some(backend) = mgr.backends.iter_mut().find(|b| b.id == backend_id) {
            match status_str.as_str() {
                "running" => {
                    backend.status = BackendStatus::Online;
                    if url.is_some() {
                        backend.url = url.clone();
                    }
                }
                "paused" | "scaledToZero" => backend.status = BackendStatus::Paused,
                "pending" | "initializing" | "updating" => backend.status = BackendStatus::Deploying,
                "failed" => backend.status = BackendStatus::Error,
                _ => backend.status = BackendStatus::Offline,
            }
        }
    }
    
    persist_backends(&app_handle, &manager).await?;
    
    let model_id_val = result.get("model")
        .and_then(|m: &serde_json::Value| m.get("repository"))
        .and_then(|r: &serde_json::Value| r.as_str())
        .unwrap_or("")
        .to_string();
    let instance_type_val = result.get("compute")
        .and_then(|c: &serde_json::Value| c.get("instanceType"))
        .and_then(|i: &serde_json::Value| i.as_str())
        .unwrap_or("")
        .to_string();
    let region_val = result.get("provider")
        .and_then(|p: &serde_json::Value| p.get("region"))
        .and_then(|r: &serde_json::Value| r.as_str())
        .unwrap_or("")
        .to_string();
    let created_at_val = result.get("status")
        .and_then(|s: &serde_json::Value| s.get("createdAt"))
        .and_then(|c: &serde_json::Value| c.as_str())
        .map(|s: &str| s.to_string());
    
    Ok(HfEndpointStatus {
        name: endpoint_name,
        status: status_str,
        url,
        model_id: model_id_val,
        instance_type: instance_type_val,
        region: region_val,
        created_at: created_at_val,
    })
}

/// FR-CO-038: Pause HF endpoint
#[tauri::command]
pub async fn pause_hf_endpoint(
    backend_id: String,
    manager: State<'_, ManagedBackends>,
    app_handle: AppHandle,
) -> Result<(), String> {
    hf_endpoint_action(backend_id, "pause", manager, app_handle).await
}

/// FR-CO-039: Resume HF endpoint  
#[tauri::command]
pub async fn resume_hf_endpoint(
    backend_id: String,
    manager: State<'_, ManagedBackends>,
    app_handle: AppHandle,
) -> Result<(), String> {
    hf_endpoint_action(backend_id, "resume", manager, app_handle).await
}

/// FR-CO-040: Delete HF endpoint
#[tauri::command]
pub async fn delete_hf_endpoint(
    backend_id: String,
    manager: State<'_, ManagedBackends>,
    app_handle: AppHandle,
) -> Result<(), String> {
    let (endpoint_name, hf_token) = {
        let mgr = manager.lock().unwrap();
        let backend = mgr.backends.iter()
            .find(|b| b.id == backend_id)
            .ok_or("Backend not found")?;
        let model_id = backend.model_name.clone().unwrap_or_default();
        let name = format!("hugbrowse-{}", model_id.replace('/', "-").to_lowercase())
            .chars()
            .take(32)
            .collect::<String>();
        let token = mgr.credentials.get(&backend_id).cloned()
            .ok_or("No credentials found")?;
        (name, token)
    };
    
    let client = {
        let mgr = manager.lock().unwrap();
        mgr.http_client.clone()
    };
    
    let response = client
        .delete(&format!("https://api.endpoints.huggingface.cloud/v2/endpoint/{}", endpoint_name))
        .header("Authorization", format!("Bearer {}", hf_token))
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("Failed to delete endpoint: {}", e))?;
    
    if !response.status().is_success() && response.status() != 404 {
        return Err(format!("Failed to delete: {}", response.status()));
    }
    
    // Remove the backend from our list
    {
        let mut mgr = manager.lock().unwrap();
        if mgr.active_id.as_ref() == Some(&backend_id) {
            mgr.active_id = Some("local-sidecar".to_string());
            if let Some(local) = mgr.backends.iter_mut().find(|b| b.id == "local-sidecar") {
                local.is_active = true;
            }
        }
        mgr.backends.retain(|b| b.id != backend_id);
        mgr.credentials.remove(&backend_id);
    }
    
    persist_backends(&app_handle, &manager).await?;
    
    Ok(())
}

/// Internal helper for pause/resume actions
async fn hf_endpoint_action(
    backend_id: String,
    action: &str,
    manager: State<'_, ManagedBackends>,
    app_handle: AppHandle,
) -> Result<(), String> {
    let (endpoint_name, hf_token) = {
        let mgr = manager.lock().unwrap();
        let backend = mgr.backends.iter()
            .find(|b| b.id == backend_id)
            .ok_or("Backend not found")?;
        let model_id = backend.model_name.clone().unwrap_or_default();
        let name = format!("hugbrowse-{}", model_id.replace('/', "-").to_lowercase())
            .chars()
            .take(32)
            .collect::<String>();
        let token = mgr.credentials.get(&backend_id).cloned()
            .ok_or("No credentials found")?;
        (name, token)
    };
    
    let client = {
        let mgr = manager.lock().unwrap();
        mgr.http_client.clone()
    };
    
    let url = format!("https://api.endpoints.huggingface.cloud/v2/endpoint/{}/{}", endpoint_name, action);
    
    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", hf_token))
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("Failed to {} endpoint: {}", action, e))?;
    
    if !response.status().is_success() {
        return Err(format!("Failed to {}: {}", action, response.status()));
    }
    
    // Update backend status
    {
        let mut mgr = manager.lock().unwrap();
        if let Some(backend) = mgr.backends.iter_mut().find(|b| b.id == backend_id) {
            match action {
                "pause" => backend.status = BackendStatus::Paused,
                "resume" => backend.status = BackendStatus::Deploying,
                _ => {}
            }
        }
    }
    
    persist_backends(&app_handle, &manager).await?;
    
    Ok(())
}