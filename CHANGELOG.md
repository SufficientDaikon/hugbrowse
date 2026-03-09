# Changelog

All notable changes to HugBrowse will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Model Management Engine** (Phase 1/8 of v1.0)
  - New `model_manager.rs` Rust module for full model lifecycle management
  - Multi-instance model loading — run multiple models simultaneously on unique ports
  - JIT (Just-In-Time) loading support — auto-load models on first API request
  - TTL (Time-To-Live) auto-unload — idle models unload after configurable timeout (default 60min)
  - Auto-eviction — LRU JIT-loaded models evicted when memory is insufficient
  - Per-instance health checking with configurable retry limits (max 3 retries)
  - Memory usage tracking (RAM/VRAM) per loaded model instance
  - New Tauri commands: `mm_load_model`, `mm_unload_model`, `mm_unload_all`, `mm_list_loaded_models`, `mm_get_model_status`, `mm_get_memory_usage`, `mm_update_config`
  - New `modelManager` Zustand store for frontend model management state
  - New `LoadedModelsPanel` component showing all loaded models with status, memory, and unload controls
  - Real-time model status events via Tauri event system (`model-status-changed`, `model-ttl-expired`)

- **API Server** (Phase 2/8 of v1.0)
  - New `api_server.rs` Rust module — embedded axum HTTP server inside Tauri app
  - OpenAI-compatible endpoints: `GET /v1/models`, `POST /v1/chat/completions` (SSE streaming + non-streaming), `POST /v1/completions`, `POST /v1/embeddings`
  - Native REST API: `GET /api/v1/status`, `GET /api/v1/models`, `POST /api/v1/models/load`, `POST /api/v1/models/unload`, `POST /api/v1/chat`
  - Configurable port (default 8080), start/stop via Tauri commands
  - SSE streaming proxy — streams llama-server responses directly to API clients
  - Standard OpenAI error format on all endpoints (message, type, code, requestId)
  - Request logging with in-memory log and real-time Tauri event emission
  - CORS support via tower-http
  - New Tauri commands: `api_server_start`, `api_server_stop`, `api_server_status`, `api_server_update_config`, `api_server_get_log`
  - New `apiServer` Zustand store for frontend server management state
  - New Developer page with server controls, status indicator, base URL display, and request log viewer
  - Developer navigation tab in header

- **Authentication & Security** (Phase 3/8 of v1.0)
  - New `auth_manager.rs` Rust module — token-based API authentication system
  - SHA-256 hashed token storage — plaintext shown once on creation, never persisted
  - Encrypted persistence via `tauri-plugin-store` (auth-tokens.json)
  - Per-token permission scoping: `inference`, `model_management`, `server_admin`, `downloads`
  - Auth enforcement on all API server routes — returns 401/403 for invalid/insufficient tokens
  - Auth toggle — enable/disable authentication globally without deleting tokens
  - New Tauri commands: `auth_create_token`, `auth_revoke_token`, `auth_delete_token`, `auth_list_tokens`, `auth_set_enabled`, `auth_is_enabled`
  - New `auth` Zustand store for frontend token management state
  - New `TokenManager` component in Developer page — create, revoke, delete tokens with permission grid
  - Token creation displays plaintext token once with copy-to-clipboard support

- **Configuration & Presets** (Phase 4/8 of v1.0)
  - New `config_manager.rs` Rust module — unified configuration system
  - `AppSettings` struct with categories: General, Models, Server, Appearance, Downloads, Advanced
  - Persistent settings to `~/.hugbrowse/config/settings.json` with safe defaults
  - `model.yaml` parser and generator — portable model descriptors with load/inference defaults
  - Inference presets system — CRUD with JSON persistence in `~/.hugbrowse/config/presets/`
  - Per-model settings with merge priority: per-model > model.yaml > preset > global defaults
  - Settings import/export support
  - Preset import/export support
  - New Tauri commands: `config_get_settings`, `config_update_settings`, `config_list_presets`, `config_create_preset`, `config_update_preset`, `config_delete_preset`, `config_get_per_model`, `config_set_per_model`, `config_parse_model_yaml`, `config_save_model_yaml`, `config_export_settings`, `config_import_settings`, `config_export_preset`, `config_import_preset`
  - New `configStore` and `presetStore` Zustand stores for frontend state management
  - New `PresetManager` component in Developer page — create, delete, expand presets with parameter display
  - Added `serde_yaml` and `chrono` Rust dependencies

## [0.3.0] - 2026-03-09

### Changed

- Version bump to v0.3.0 for automated release pipeline validation
- Auto-updater flow: installed clients check `latest.json` on launch → show update notification → one-click install

## [0.2.0] - 2026-03-09

### Added

- **Cloud Offload** — run inference on remote servers instead of (or alongside) local hardware
  - Compute Backend abstraction: Local Sidecar, HuggingFace Endpoints, Custom URL
  - Backend selector dropdown in chat interface with status indicators and latency
  - Add/remove/switch backends from Settings → Compute Backends
  - Connection testing with latency measurement for custom endpoints
  - One-click "Deploy to Cloud" from any model detail page via HuggingFace Inference Endpoints
  - HF Endpoint lifecycle management: deploy, check status, pause, resume, delete
  - Streaming chat proxy through Tauri backend (solves CORS, centralizes auth)
  - Backend tracking on chat messages — see which backend generated each response
  - Persistent backend configuration across app restarts
  - Secure API key storage for remote endpoints

## [0.1.0] - 2026-03-08

### Added

- Initial release of HugBrowse
- Model browser with search and filters (pipeline type, library, sort order)
- Hardware tier detection (Entry / Mid / High / Ultra) and compatibility scoring
- Download manager with pause, resume, cancel and SHA-256 integrity verification
- Local inference engine via llama-server sidecar with GPU auto-detection (CUDA / Metal / Vulkan)
- Chat interface with markdown rendering and streaming responses
- Resource monitor for CPU, RAM, GPU, VRAM, and disk usage
- Community marketplace for browsing, publishing, and reviewing extensions
- Plugin system architecture for community-contributed extensions
- Auto-updater integrated with GitHub Releases
- Deep-link support via `hugbrowse://` protocol for one-click model imports
- System tray with quick actions
- Onboarding wizard for first-time setup
- RAG document attachment support (PDF, DOCX, plain text)
- Privacy-first design — all inference and data stays local
- GGUF file association for direct model opening
- MSI and NSIS installer targets for Windows

### Fixed

- MSVC toolchain detection for Windows builds
- Shell plugin v2 configuration compatibility
