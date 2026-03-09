//! API Server — Phase 2 of HugBrowse v1.0
//!
//! Embeds an axum HTTP server inside the Tauri app, sharing the same
//! Tokio runtime. Provides OpenAI-compatible endpoints (GET /v1/models,
//! POST /v1/chat/completions, etc.) plus native REST endpoints for
//! model management. Supports SSE streaming for chat completions.

use axum::{
    extract::{Json, State as AxumState},
    http::StatusCode,
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse, Response,
    },
    routing::{get, post},
    Router,
};
use futures_util::stream::Stream;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::net::SocketAddr;
use std::pin::Pin;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;
use tower_http::cors::{Any, CorsLayer};
use uuid::Uuid;

use crate::model_manager::{
    LoadOptions, LoadedModel, ManagedModelManager, ModelStatus,
};

// ── Server Configuration ──────────────────────────────────────────────

/// Configuration for the API server (matches Omega Spec §7.2).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerConfig {
    pub port: u16,
    pub host: String,
    pub cors_enabled: bool,
    pub cors_origins: Vec<String>,
    pub auth_required: bool,
    pub jit_loading_enabled: bool,
    pub default_ttl_seconds: u64,
    pub auto_evict_enabled: bool,
    pub max_concurrent_requests: u32,
    pub request_logging: bool,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            port: 8080,
            host: "127.0.0.1".to_string(),
            cors_enabled: true,
            cors_origins: vec!["*".to_string()],
            auth_required: false,
            jit_loading_enabled: true,
            default_ttl_seconds: 3600,
            auto_evict_enabled: true,
            max_concurrent_requests: 10,
            request_logging: true,
        }
    }
}

// ── Server State ──────────────────────────────────────────────────────

/// Shared state accessible by all axum route handlers.
#[derive(Clone)]
pub struct ApiState {
    pub model_manager: ManagedModelManager,
    pub app_handle: AppHandle,
    pub config: Arc<Mutex<ServerConfig>>,
    pub request_log: Arc<Mutex<VecDeque<RequestLogEntry>>>,
}

/// Entry in the request log shown in Developer Tab.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestLogEntry {
    pub id: String,
    pub method: String,
    pub path: String,
    pub status: u16,
    pub duration_ms: u64,
    pub timestamp: u64,
    pub model: Option<String>,
}

/// Server runtime state — holds the shutdown handle.
pub struct ApiServer {
    pub config: ServerConfig,
    pub running: bool,
    shutdown_tx: Option<tokio::sync::oneshot::Sender<()>>,
}

pub type ManagedApiServer = Arc<Mutex<ApiServer>>;

impl ApiServer {
    pub fn new() -> Self {
        Self {
            config: ServerConfig::default(),
            running: false,
            shutdown_tx: None,
        }
    }
}

// ── OpenAI-Compatible Types ───────────────────────────────────────────

#[derive(Debug, Serialize)]
struct ModelObject {
    id: String,
    object: &'static str,
    created: u64,
    owned_by: &'static str,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    permission: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize)]
struct ModelList {
    object: &'static str,
    data: Vec<ModelObject>,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionsRequest {
    model: Option<String>,
    messages: Vec<ChatMessage>,
    #[serde(default)]
    stream: Option<bool>,
    temperature: Option<f64>,
    max_tokens: Option<u32>,
    top_p: Option<f64>,
    stop: Option<serde_json::Value>,
    #[allow(dead_code)]
    tools: Option<serde_json::Value>,
    #[allow(dead_code)]
    response_format: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct CompletionsRequest {
    model: Option<String>,
    prompt: String,
    #[serde(default)]
    stream: Option<bool>,
    temperature: Option<f64>,
    max_tokens: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct EmbeddingsRequest {
    model: Option<String>,
    input: serde_json::Value,
}

/// Standard error response (Omega Spec §7.5).
#[derive(Debug, Serialize)]
struct ApiError {
    error: ApiErrorInner,
}

#[derive(Debug, Serialize)]
struct ApiErrorInner {
    message: String,
    #[serde(rename = "type")]
    error_type: String,
    code: u16,
    #[serde(rename = "requestId")]
    request_id: String,
}

impl ApiError {
    fn new(message: impl Into<String>, error_type: impl Into<String>, code: u16) -> Self {
        Self {
            error: ApiErrorInner {
                message: message.into(),
                error_type: error_type.into(),
                code,
                request_id: format!("req-{}", Uuid::new_v4()),
            },
        }
    }

    fn response(self, status: StatusCode) -> Response {
        (status, Json(self)).into_response()
    }
}

// ── Native REST Types ─────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativeLoadRequest {
    model: String,
    #[allow(dead_code)]
    quantization: Option<String>,
    gpu: Option<f64>,
    context_length: Option<u32>,
    identifier: Option<String>,
    ttl: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct NativeUnloadRequest {
    #[serde(rename = "instanceId")]
    instance_id: Option<String>,
    model: Option<String>,
}

#[derive(Debug, Deserialize)]
struct NativeChatRequest {
    model: Option<String>,
    messages: Vec<ChatMessage>,
    #[serde(default)]
    stream: Option<bool>,
    temperature: Option<f64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ServerStatus {
    status: &'static str,
    version: &'static str,
    loaded_models: usize,
    uptime_seconds: u64,
}

// ── Router Setup ──────────────────────────────────────────────────────

/// Build the axum router with all endpoints.
fn build_router(state: ApiState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        // OpenAI-compatible endpoints
        .route("/v1/models", get(get_v1_models))
        .route("/v1/chat/completions", post(post_v1_chat_completions))
        .route("/v1/completions", post(post_v1_completions))
        .route("/v1/embeddings", post(post_v1_embeddings))
        // Native REST API
        .route("/api/v1/status", get(get_api_status))
        .route("/api/v1/models", get(get_api_models))
        .route("/api/v1/models/load", post(post_api_models_load))
        .route("/api/v1/models/unload", post(post_api_models_unload))
        .route("/api/v1/chat", post(post_api_chat))
        .layer(cors)
        .with_state(state)
}

// ── Server Start / Stop ───────────────────────────────────────────────

/// Start the API server on the configured host:port.
/// Returns immediately; the server runs in a spawned tokio task.
pub async fn start_server(
    app: AppHandle,
    model_manager: ManagedModelManager,
    server_state: &ManagedApiServer,
) -> Result<(), String> {
    let mut srv = server_state.lock().await;
    if srv.running {
        return Err("API server is already running".into());
    }

    let config = srv.config.clone();
    let addr: SocketAddr = format!("{}:{}", config.host, config.port)
        .parse()
        .map_err(|e| format!("Invalid address: {e}"))?;

    let api_state = ApiState {
        model_manager,
        app_handle: app.clone(),
        config: Arc::new(Mutex::new(config.clone())),
        request_log: Arc::new(Mutex::new(VecDeque::with_capacity(200))),
    };

    let router = build_router(api_state.clone());

    let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel::<()>();

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| format!("Failed to bind {addr}: {e}"))?;

    let log_for_emit = api_state.request_log.clone();

    tokio::spawn(async move {
        axum::serve(listener, router)
            .with_graceful_shutdown(async {
                let _ = shutdown_rx.await;
            })
            .await
            .ok();
    });

    srv.running = true;
    srv.shutdown_tx = Some(shutdown_tx);

    let _ = app.emit(
        "api-server-status",
        serde_json::json!({
            "running": true,
            "port": config.port,
            "host": config.host
        }),
    );

    log::info!("API server started on {addr}");
    let _ = log_for_emit; // keep reference alive (used by routes via ApiState)
    Ok(())
}

/// Stop the API server gracefully.
pub async fn stop_server(server_state: &ManagedApiServer, app: &AppHandle) -> Result<(), String> {
    let mut srv = server_state.lock().await;
    if !srv.running {
        return Err("API server is not running".into());
    }

    if let Some(tx) = srv.shutdown_tx.take() {
        let _ = tx.send(());
    }

    srv.running = false;

    let _ = app.emit(
        "api-server-status",
        serde_json::json!({
            "running": false,
            "port": srv.config.port
        }),
    );

    log::info!("API server stopped");
    Ok(())
}

// ── Helper: Resolve Model for Inference ───────────────────────────────

/// Find a ready model instance by model name/identifier, or return the first ready model.
async fn resolve_model(
    mm: &ManagedModelManager,
    model_hint: Option<&str>,
) -> Option<LoadedModel> {
    let mgr = mm.lock().await;
    if let Some(hint) = model_hint {
        // Try exact identifier match
        if let Some(m) = mgr.find_by_identifier(hint) {
            if m.status == ModelStatus::Ready {
                return Some(m.clone());
            }
        }
        // Try path match
        if let Some(m) = mgr.find_by_path(hint) {
            if m.status == ModelStatus::Ready {
                return Some(m.clone());
            }
        }
        // Try model name contains match
        for m in mgr.loaded_models.values() {
            if m.status == ModelStatus::Ready
                && (m.model_name.contains(hint) || m.identifier.contains(hint))
            {
                return Some(m.clone());
            }
        }
    }
    // Fallback: first ready model
    mgr.loaded_models
        .values()
        .find(|m| m.status == ModelStatus::Ready)
        .cloned()
}

/// Log a request to the in-memory request log + emit event.
async fn log_request(
    state: &ApiState,
    method: &str,
    path: &str,
    status: u16,
    duration_ms: u64,
    model: Option<String>,
) {
    let entry = RequestLogEntry {
        id: Uuid::new_v4().to_string(),
        method: method.to_string(),
        path: path.to_string(),
        status,
        duration_ms,
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
        model,
    };
    {
        let mut log = state.request_log.lock().await;
        if log.len() >= 200 {
            log.pop_front();
        }
        log.push_back(entry.clone());
    }
    let _ = state.app_handle.emit("api-request-logged", &entry);
}

// ── OpenAI-Compatible Route Handlers ──────────────────────────────────

/// GET /v1/models — list loaded models in OpenAI format.
async fn get_v1_models(AxumState(state): AxumState<ApiState>) -> Response {
    let start = std::time::Instant::now();
    let mgr = state.model_manager.lock().await;
    let models: Vec<ModelObject> = mgr
        .loaded_models
        .values()
        .filter(|m| m.status == ModelStatus::Ready)
        .map(|m| ModelObject {
            id: m.identifier.clone(),
            object: "model",
            created: m.loaded_at,
            owned_by: "hugbrowse",
            permission: vec![],
        })
        .collect();
    drop(mgr);

    let resp = ModelList {
        object: "list",
        data: models,
    };

    log_request(&state, "GET", "/v1/models", 200, start.elapsed().as_millis() as u64, None).await;
    Json(resp).into_response()
}

/// POST /v1/chat/completions — chat completions with streaming (SSE) support.
async fn post_v1_chat_completions(
    AxumState(state): AxumState<ApiState>,
    Json(req): Json<ChatCompletionsRequest>,
) -> Response {
    let start = std::time::Instant::now();
    let model_hint = req.model.as_deref();

    // Resolve model
    let model = match resolve_model(&state.model_manager, model_hint).await {
        Some(m) => m,
        None => {
            let model_name = model_hint.unwrap_or("(none)");
            log_request(&state, "POST", "/v1/chat/completions", 404, start.elapsed().as_millis() as u64, Some(model_name.to_string())).await;
            return ApiError::new(
                format!("Model '{}' not found or not loaded", model_name),
                "model_not_found",
                404,
            )
            .response(StatusCode::NOT_FOUND);
        }
    };

    // Touch the model (update last_used_at)
    {
        let mut mgr = state.model_manager.lock().await;
        mgr.touch(&model.instance_id);
    }

    let port = model.port;
    let streaming = req.stream.unwrap_or(false);

    // Build request to llama-server
    let mut payload = serde_json::json!({
        "messages": req.messages,
        "stream": streaming,
    });
    if let Some(t) = req.temperature {
        payload["temperature"] = serde_json::json!(t);
    }
    if let Some(mt) = req.max_tokens {
        payload["max_tokens"] = serde_json::json!(mt);
    }
    if let Some(tp) = req.top_p {
        payload["top_p"] = serde_json::json!(tp);
    }
    if let Some(ref s) = req.stop {
        payload["stop"] = s.clone();
    }

    let url = format!("http://127.0.0.1:{port}/v1/chat/completions");

    if streaming {
        // SSE streaming response
        match stream_from_llama_server(&url, &payload).await {
            Ok(stream) => {
                log_request(&state, "POST", "/v1/chat/completions", 200, start.elapsed().as_millis() as u64, Some(model.identifier.clone())).await;
                Sse::new(stream)
                    .keep_alive(KeepAlive::default())
                    .into_response()
            }
            Err(e) => {
                log_request(&state, "POST", "/v1/chat/completions", 502, start.elapsed().as_millis() as u64, Some(model.identifier.clone())).await;
                ApiError::new(
                    format!("Upstream error: {e}"),
                    "upstream_error",
                    502,
                )
                .response(StatusCode::BAD_GATEWAY)
            }
        }
    } else {
        // Non-streaming: proxy the full response
        match proxy_to_llama_server(&url, &payload).await {
            Ok(body) => {
                log_request(&state, "POST", "/v1/chat/completions", 200, start.elapsed().as_millis() as u64, Some(model.identifier.clone())).await;
                (StatusCode::OK, [("content-type", "application/json")], body).into_response()
            }
            Err(e) => {
                log_request(&state, "POST", "/v1/chat/completions", 502, start.elapsed().as_millis() as u64, Some(model.identifier.clone())).await;
                ApiError::new(format!("Upstream error: {e}"), "upstream_error", 502)
                    .response(StatusCode::BAD_GATEWAY)
            }
        }
    }
}

/// POST /v1/completions — text completions.
async fn post_v1_completions(
    AxumState(state): AxumState<ApiState>,
    Json(req): Json<CompletionsRequest>,
) -> Response {
    let start = std::time::Instant::now();
    let model_hint = req.model.as_deref();

    let model = match resolve_model(&state.model_manager, model_hint).await {
        Some(m) => m,
        None => {
            log_request(&state, "POST", "/v1/completions", 404, start.elapsed().as_millis() as u64, None).await;
            return ApiError::new("No model loaded", "model_not_found", 404)
                .response(StatusCode::NOT_FOUND);
        }
    };

    {
        let mut mgr = state.model_manager.lock().await;
        mgr.touch(&model.instance_id);
    }

    let port = model.port;
    let streaming = req.stream.unwrap_or(false);

    let mut payload = serde_json::json!({
        "prompt": req.prompt,
        "stream": streaming,
    });
    if let Some(t) = req.temperature {
        payload["temperature"] = serde_json::json!(t);
    }
    if let Some(mt) = req.max_tokens {
        payload["max_tokens"] = serde_json::json!(mt);
    }

    let url = format!("http://127.0.0.1:{port}/v1/completions");

    if streaming {
        match stream_from_llama_server(&url, &payload).await {
            Ok(stream) => {
                log_request(&state, "POST", "/v1/completions", 200, start.elapsed().as_millis() as u64, Some(model.identifier.clone())).await;
                Sse::new(stream)
                    .keep_alive(KeepAlive::default())
                    .into_response()
            }
            Err(e) => {
                log_request(&state, "POST", "/v1/completions", 502, start.elapsed().as_millis() as u64, None).await;
                ApiError::new(format!("Upstream error: {e}"), "upstream_error", 502)
                    .response(StatusCode::BAD_GATEWAY)
            }
        }
    } else {
        match proxy_to_llama_server(&url, &payload).await {
            Ok(body) => {
                log_request(&state, "POST", "/v1/completions", 200, start.elapsed().as_millis() as u64, Some(model.identifier.clone())).await;
                (StatusCode::OK, [("content-type", "application/json")], body).into_response()
            }
            Err(e) => {
                log_request(&state, "POST", "/v1/completions", 502, start.elapsed().as_millis() as u64, None).await;
                ApiError::new(format!("Upstream error: {e}"), "upstream_error", 502)
                    .response(StatusCode::BAD_GATEWAY)
            }
        }
    }
}

/// POST /v1/embeddings — text embeddings.
async fn post_v1_embeddings(
    AxumState(state): AxumState<ApiState>,
    Json(req): Json<EmbeddingsRequest>,
) -> Response {
    let start = std::time::Instant::now();
    let model_hint = req.model.as_deref();

    let model = match resolve_model(&state.model_manager, model_hint).await {
        Some(m) => m,
        None => {
            log_request(&state, "POST", "/v1/embeddings", 404, start.elapsed().as_millis() as u64, None).await;
            return ApiError::new("No embedding model loaded", "model_not_found", 404)
                .response(StatusCode::NOT_FOUND);
        }
    };

    {
        let mut mgr = state.model_manager.lock().await;
        mgr.touch(&model.instance_id);
    }

    let port = model.port;
    let payload = serde_json::json!({
        "input": req.input,
    });

    let url = format!("http://127.0.0.1:{port}/v1/embeddings");

    match proxy_to_llama_server(&url, &payload).await {
        Ok(body) => {
            log_request(&state, "POST", "/v1/embeddings", 200, start.elapsed().as_millis() as u64, Some(model.identifier.clone())).await;
            (StatusCode::OK, [("content-type", "application/json")], body).into_response()
        }
        Err(e) => {
            log_request(&state, "POST", "/v1/embeddings", 502, start.elapsed().as_millis() as u64, None).await;
            ApiError::new(format!("Upstream error: {e}"), "upstream_error", 502)
                .response(StatusCode::BAD_GATEWAY)
        }
    }
}

// ── Native REST Route Handlers ────────────────────────────────────────

/// GET /api/v1/status — server health check.
async fn get_api_status(AxumState(state): AxumState<ApiState>) -> Response {
    let mgr = state.model_manager.lock().await;
    let loaded_count = mgr
        .loaded_models
        .values()
        .filter(|m| m.status == ModelStatus::Ready)
        .count();
    drop(mgr);

    Json(ServerStatus {
        status: "ok",
        version: env!("CARGO_PKG_VERSION"),
        loaded_models: loaded_count,
        uptime_seconds: 0, // TODO: track server start time
    })
    .into_response()
}

/// GET /api/v1/models — extended model list (downloaded + loaded).
async fn get_api_models(AxumState(state): AxumState<ApiState>) -> Response {
    let mgr = state.model_manager.lock().await;
    let models: Vec<LoadedModel> = mgr.loaded_models.values().cloned().collect();
    drop(mgr);
    Json(models).into_response()
}

/// POST /api/v1/models/load — load a model via API.
async fn post_api_models_load(
    AxumState(state): AxumState<ApiState>,
    Json(req): Json<NativeLoadRequest>,
) -> Response {
    let start = std::time::Instant::now();

    let gpu_str = req.gpu.map(|g| {
        if g >= 1.0 { "max".to_string() }
        else if g <= 0.0 { "off".to_string() }
        else { format!("{g}") }
    }).unwrap_or_else(|| "max".to_string());

    let opts = LoadOptions {
        gpu: gpu_str,
        context_length: req.context_length,
        identifier: req.identifier,
        ttl: req.ttl,
        gpu_device: None,
    };

    // We need to call the model manager's load logic.
    // Since we don't have Tauri State here, we directly use the ManagedModelManager.
    let model_path = req.model.clone();
    let model_name = model_path
        .split(['/', '\\'])
        .last()
        .unwrap_or(&model_path)
        .to_string();

    // We'll replicate the load logic inline since we can't call Tauri commands from axum.
    // For now, return a 501 if model_path doesn't exist on disk — the caller should use
    // a proper model path. In the future, JIT loading can resolve identifiers.
    let _instance_id = Uuid::new_v4().to_string();

    log_request(&state, "POST", "/api/v1/models/load", 200, start.elapsed().as_millis() as u64, Some(req.model.clone())).await;

    // Use internal load logic via app_handle and the Tauri shell plugin
    match crate::model_manager::api_load_model(
        &state.app_handle,
        &state.model_manager,
        model_path,
        model_name,
        Some(opts),
    )
    .await
    {
        Ok(loaded) => Json(serde_json::json!({
            "instanceId": loaded.instance_id,
            "status": loaded.status,
        }))
        .into_response(),
        Err(e) => {
            ApiError::new(e, "load_error", 500).response(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// POST /api/v1/models/unload — unload a model via API.
async fn post_api_models_unload(
    AxumState(state): AxumState<ApiState>,
    Json(req): Json<NativeUnloadRequest>,
) -> Response {
    let start = std::time::Instant::now();

    let instance_id = if let Some(id) = req.instance_id {
        id
    } else if let Some(model_name) = req.model {
        // Find by name/identifier
        let mgr = state.model_manager.lock().await;
        let found = mgr
            .loaded_models
            .iter()
            .find(|(_, m)| m.model_name == model_name || m.identifier == model_name)
            .map(|(id, _)| id.clone());
        drop(mgr);
        match found {
            Some(id) => id,
            None => {
                log_request(&state, "POST", "/api/v1/models/unload", 404, start.elapsed().as_millis() as u64, None).await;
                return ApiError::new("Model not found", "model_not_found", 404)
                    .response(StatusCode::NOT_FOUND);
            }
        }
    } else {
        log_request(&state, "POST", "/api/v1/models/unload", 400, start.elapsed().as_millis() as u64, None).await;
        return ApiError::new(
            "Must provide instanceId or model",
            "bad_request",
            400,
        )
        .response(StatusCode::BAD_REQUEST);
    };

    match crate::model_manager::api_unload_model(&state.app_handle, &state.model_manager, &instance_id).await {
        Ok(()) => {
            log_request(&state, "POST", "/api/v1/models/unload", 200, start.elapsed().as_millis() as u64, None).await;
            Json(serde_json::json!({ "status": "unloaded" })).into_response()
        }
        Err(e) => {
            log_request(&state, "POST", "/api/v1/models/unload", 500, start.elapsed().as_millis() as u64, None).await;
            ApiError::new(e, "unload_error", 500).response(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// POST /api/v1/chat — native stateful chat with model loading events.
async fn post_api_chat(
    AxumState(state): AxumState<ApiState>,
    Json(req): Json<NativeChatRequest>,
) -> Response {
    let start = std::time::Instant::now();
    let model_hint = req.model.as_deref();

    let model = match resolve_model(&state.model_manager, model_hint).await {
        Some(m) => m,
        None => {
            log_request(&state, "POST", "/api/v1/chat", 404, start.elapsed().as_millis() as u64, None).await;
            return ApiError::new("No model loaded", "model_not_found", 404)
                .response(StatusCode::NOT_FOUND);
        }
    };

    {
        let mut mgr = state.model_manager.lock().await;
        mgr.touch(&model.instance_id);
    }

    let port = model.port;
    let streaming = req.stream.unwrap_or(true);

    let mut payload = serde_json::json!({
        "messages": req.messages,
        "stream": streaming,
    });
    if let Some(t) = req.temperature {
        payload["temperature"] = serde_json::json!(t);
    }

    let url = format!("http://127.0.0.1:{port}/v1/chat/completions");

    if streaming {
        match stream_from_llama_server(&url, &payload).await {
            Ok(stream) => {
                log_request(&state, "POST", "/api/v1/chat", 200, start.elapsed().as_millis() as u64, Some(model.identifier.clone())).await;
                Sse::new(stream)
                    .keep_alive(KeepAlive::default())
                    .into_response()
            }
            Err(e) => {
                log_request(&state, "POST", "/api/v1/chat", 502, start.elapsed().as_millis() as u64, None).await;
                ApiError::new(format!("Upstream error: {e}"), "upstream_error", 502)
                    .response(StatusCode::BAD_GATEWAY)
            }
        }
    } else {
        match proxy_to_llama_server(&url, &payload).await {
            Ok(body) => {
                log_request(&state, "POST", "/api/v1/chat", 200, start.elapsed().as_millis() as u64, Some(model.identifier.clone())).await;
                (StatusCode::OK, [("content-type", "application/json")], body).into_response()
            }
            Err(e) => {
                log_request(&state, "POST", "/api/v1/chat", 502, start.elapsed().as_millis() as u64, None).await;
                ApiError::new(format!("Upstream error: {e}"), "upstream_error", 502)
                    .response(StatusCode::BAD_GATEWAY)
            }
        }
    }
}

// ── Upstream Proxying Helpers ─────────────────────────────────────────

/// Proxy a request to llama-server and return the full response body.
async fn proxy_to_llama_server(
    url: &str,
    payload: &serde_json::Value,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post(url)
        .json(payload)
        .timeout(std::time::Duration::from_secs(120))
        .send()
        .await
        .map_err(|e| format!("Request to llama-server failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("llama-server returned {status}: {body}"));
    }

    resp.text()
        .await
        .map_err(|e| format!("Failed to read response body: {e}"))
}

/// Stream SSE events from llama-server back to the client.
async fn stream_from_llama_server(
    url: &str,
    payload: &serde_json::Value,
) -> Result<
    Pin<Box<dyn Stream<Item = Result<Event, std::convert::Infallible>> + Send>>,
    String,
> {
    let client = reqwest::Client::new();
    let resp = client
        .post(url)
        .json(payload)
        .timeout(std::time::Duration::from_secs(300))
        .send()
        .await
        .map_err(|e| format!("Request to llama-server failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("llama-server returned {status}: {body}"));
    }

    let byte_stream = resp.bytes_stream();

    let stream = async_stream::stream! {
        use futures_util::StreamExt;
        let mut buffer = String::new();
        let mut byte_stream = std::pin::pin!(byte_stream);

        while let Some(chunk_result) = byte_stream.next().await {
            match chunk_result {
                Ok(bytes) => {
                    buffer.push_str(&String::from_utf8_lossy(&bytes));
                    // Process complete SSE lines
                    while let Some(line_end) = buffer.find('\n') {
                        let line = buffer[..line_end].trim().to_string();
                        buffer.drain(..=line_end);

                        if line.starts_with("data: ") {
                            let data = &line[6..];
                            if data == "[DONE]" {
                                yield Ok(Event::default().data("[DONE]"));
                                return;
                            }
                            yield Ok(Event::default().data(data));
                        }
                    }
                }
                Err(_) => {
                    yield Ok(Event::default().data("[DONE]"));
                    return;
                }
            }
        }
        // Stream ended without [DONE]
        yield Ok(Event::default().data("[DONE]"));
    };

    Ok(Box::pin(stream))
}

// ── Tauri Commands for API Server Control ─────────────────────────────

/// Start the API server.
#[tauri::command]
pub async fn api_server_start(
    app: AppHandle,
    model_manager: tauri::State<'_, ManagedModelManager>,
    server: tauri::State<'_, ManagedApiServer>,
) -> Result<(), String> {
    start_server(app, model_manager.inner().clone(), server.inner()).await
}

/// Stop the API server.
#[tauri::command]
pub async fn api_server_stop(
    app: AppHandle,
    server: tauri::State<'_, ManagedApiServer>,
) -> Result<(), String> {
    stop_server(server.inner(), &app).await
}

/// Get the API server status.
#[tauri::command]
pub async fn api_server_status(
    server: tauri::State<'_, ManagedApiServer>,
) -> Result<serde_json::Value, String> {
    let srv = server.lock().await;
    Ok(serde_json::json!({
        "running": srv.running,
        "port": srv.config.port,
        "host": srv.config.host,
    }))
}

/// Update the API server config (must stop/start to apply).
#[tauri::command]
pub async fn api_server_update_config(
    server: tauri::State<'_, ManagedApiServer>,
    config: ServerConfig,
) -> Result<(), String> {
    let mut srv = server.lock().await;
    if srv.running {
        return Err("Stop the server before changing config".into());
    }
    srv.config = config;
    Ok(())
}

/// Get the request log.
#[tauri::command]
pub async fn api_server_get_log(
    _server: tauri::State<'_, ManagedApiServer>,
) -> Result<Vec<RequestLogEntry>, String> {
    // The log is stored in ApiState, not ApiServer. For now return empty.
    // TODO: Share request_log between ApiServer and ApiState properly.
    Ok(vec![])
}
