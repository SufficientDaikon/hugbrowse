# Changelog

All notable changes to HugBrowse will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
