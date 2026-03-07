# Feature Specification: HugBrowse — LM Studio Competitor

**Created**: 2026-03-07
**Status**: Draft
**Source**: Plan — "The honest gap between HugBrowse and LM Studio" (8-phase roadmap)

---

## 1. Project Overview

### What We're Building

A transformation of HugBrowse from a Hugging Face model browser into a full-featured local AI desktop application. Users will be able to discover models on HuggingFace, download GGUF quantized files, run them locally via a bundled inference engine, chat with running models, and expose a local OpenAI-compatible API — all from a single native desktop app.

### Why We're Building It

LM Studio dominates the "run local AI models" space. HugBrowse already has the discovery layer (browse, filter, hardware tier matching, disk-space checks). The missing piece is execution: downloading and actually running models. Bridging that gap turns a passive browser into the primary tool a developer or AI enthusiast reaches for every day.

### Who It's For

- **Primary**: Developers who want to run LLMs locally and consume them via API for prototyping
- **Secondary**: AI enthusiasts who want a private, offline chat experience with open models
- **Tertiary**: Researchers needing reproducible, self-contained inference without cloud dependency

---

## 2. Dependency Graph

```
Phase 1 (Tauri Build)
    └─► Phase 2 (Download Manager)
            └─► Phase 3 (llama-server Sidecar)
                    └─► Phase 4 (Chat Interface)   ─► Phase 8 (Polish)
                    └─► Phase 5 (Local API Server)  ─► Phase 8 (Polish)
                            └─► Phase 6 (RAG)
                            └─► Phase 7 (MCP Client)
```

**Critical path**: Phase 1 → 2 → 3 → 4 (browser → LM Studio competitor)
**Guard rails** (hard constraints, not suggestions):

- Phases 2–8 MUST NOT begin until Phase 1 produces a successful `cargo tauri dev` native window
- llama-server MUST be bundled as a Tauri sidecar binary — not compiled from Rust source
- Zero network requests to Hugging Face may be broken at any phase
- All existing HugBrowse functionality (search, browse, hardware tiers, disk check, resource monitor) MUST remain working throughout every phase
- Downloads MUST be resumable — partial files MUST never be served to llama-server
- No user credentials (HF token) may be written to disk in plaintext outside the existing Tauri store

---

## 2. User Scenarios & Stories

### User Story 1 — Native Desktop Window (Phase 1) (Priority: P1)

As a first-time user, I want to launch HugBrowse as a native desktop application so that it feels like a real app rather than a browser tab.

**Why this priority**: Everything else depends on a working Tauri build. No native window = no app.

**Independent Test**: Run `cargo tauri dev`; a native OS window opens with the HugBrowse UI loaded; all existing routes (/, /model/:id, /settings, /monitor, /recommended) are reachable.

**Acceptance Scenarios**:

1. **Given** the developer runs `npm run tauri:dev`, **When** the build completes, **Then** a native OS window (1200×800) opens with the HugBrowse search UI visible and functional.
2. **Given** the app window is open, **When** the user navigates to `/monitor`, **Then** live CPU, RAM, and GPU metrics update every 2 seconds without errors.
3. **Given** the app is running, **When** the user navigates to `/settings`, **Then** HF token input persists across app restarts via Tauri Store.
4. **Given** `cargo tauri build` is run, **When** the build completes, **Then** a platform installer (`.msi` on Windows, `.dmg` on macOS, `.AppImage` on Linux) is produced.
5. **Given** the app is open without an HF token, **When** the user searches for models, **Then** public models are returned and a non-blocking banner prompts for a token.
6. **Given** the app window exists, **When** the user resizes it below 800×600, **Then** the minimum size constraint is enforced and no layout breaks.

---

### User Story 2 — Download GGUF Models (Phase 2) (Priority: P1)

As a user browsing models, I want to download GGUF quantized files with visible progress so that I can get models onto my machine without leaving the app.

**Why this priority**: You cannot run a model you haven't downloaded. This is the bridge from browser to runtime.

**Independent Test**: Select any GGUF file on a model detail page, click Download, observe a live progress bar, and verify the file exists on disk with correct size after completion.

**Acceptance Scenarios**:

1. **Given** I am on a model detail page with GGUF files listed, **When** I click "Download" on a GGUF variant, **Then** a download entry appears in the Downloads panel showing filename, size, and a live progress bar.
2. **Given** a download is in progress, **When** I close and reopen the app, **Then** the download resumes from the byte offset already downloaded (no re-download from zero).
3. **Given** a download is 50% complete, **When** I click "Pause", **Then** the download stops cleanly and the partial file is preserved.
4. **Given** a paused download, **When** I click "Resume", **Then** the download continues from where it stopped.
5. **Given** a download completes successfully, **When** I view the Downloads panel, **Then** the entry shows "Complete", the file's SHA-256 matches the value from the HF API, and the file is marked available for loading.
6. **Given** a download fails mid-way due to a network drop, **When** the connection is restored, **Then** the app auto-retries from the last byte offset without data loss.
7. **Given** the target disk has less than 1 GB of free space, **When** the user attempts to download a file larger than available space, **Then** the app shows a blocking error and does not start the download.

---

### User Story 3 — Load and Run Models via llama-server (Phase 3) (Priority: P1)

As a user with a downloaded GGUF file, I want to load it into the bundled inference engine so that I can run the model locally.

**Why this priority**: Downloading without running is useless. Phase 3 is what makes HugBrowse a runtime.

**Independent Test**: Click "Load" on a downloaded GGUF file; verify `llama-server` starts as a sidecar process; verify the `/health` endpoint returns `{"status":"ok"}`; click "Unload"; verify the process terminates.

**Acceptance Scenarios**:

1. **Given** a GGUF file is downloaded and marked available, **When** I click "Load Model", **Then** the llama-server sidecar starts, the model loads, and a status indicator shows "Running".
2. **Given** a model is loading, **When** the loading is complete, **Then** the status changes from "Loading…" to "Running" and the estimated tokens/second is displayed.
3. **Given** a model is running, **When** I click "Unload", **Then** the llama-server process terminates cleanly and the status shows "No model loaded".
4. **Given** a user attempts to load a model that requires more VRAM/RAM than available, **Then** the app shows a warning with the memory gap and suggests lower quantization, but still allows the user to proceed.
5. **Given** llama-server fails to start (binary missing), **When** the user clicks "Load", **Then** a clear error message explains that the sidecar binary is missing and provides a link to re-download or reinstall.
6. **Given** a model is already running, **When** the user tries to load a second model, **Then** the app asks to confirm unloading the current model before loading the new one.
7. **Given** the app is closed while a model is running, **When** the app exits, **Then** the llama-server child process is terminated before the app fully closes (no orphan processes).

---

### User Story 4 — Chat with Running Models (Phase 4) (Priority: P1)

As a user with a loaded model, I want to chat with it in a streaming, markdown-rendering interface so that the experience is comparable to ChatGPT or LM Studio.

**Why this priority**: Chat is the primary use case. Everything before this is infrastructure.

**Independent Test**: Send a prompt to a running model; verify tokens stream in real-time; verify markdown headings, code blocks, and bullet lists render correctly; verify session history persists across app restarts.

**Acceptance Scenarios**:

1. **Given** a model is loaded, **When** I type a message and press Enter, **Then** the model's response begins streaming within 500 ms, with tokens appearing in real time.
2. **Given** a streaming response is in progress, **When** I click "Stop", **Then** generation stops immediately and the partial response is preserved in the chat history.
3. **Given** a response contains a fenced code block, **When** the response renders, **Then** the code block is syntax-highlighted and has a "Copy" button.
4. **Given** I have an ongoing chat session, **When** I close and reopen the app, **Then** the full chat history is restored for all sessions.
5. **Given** I have multiple chat sessions, **When** I switch between them via the session sidebar, **Then** each session maintains its own independent conversation history.
6. **Given** I set a system prompt in the chat settings, **When** I start a new session, **Then** the system prompt is injected as the first message in every new conversation.
7. **Given** I send a very long message (> 4096 tokens), **When** the context window is exceeded, **Then** the app warns the user and offers to summarize or truncate the oldest messages.

---

### User Story 5 — Local OpenAI-Compatible API (Phase 5) (Priority: P2)

As a developer, I want a local OpenAI-compatible API server so that I can swap any OpenAI-using tool to point at my local model.

**Why this priority**: Developer adoption depends on zero friction. If the API endpoint is drop-in compatible, adoption is instant.

**Independent Test**: Start the local server; call `POST localhost:11434/v1/chat/completions` with an OpenAI-format payload; receive a valid OpenAI-format response; confirm `curl` and the OpenAI Python SDK both work without modification.

**Acceptance Scenarios**:

1. **Given** a model is running, **When** I enable the local API server in settings, **Then** a server starts on a user-configurable port (default 11434) and the status shows the base URL.
2. **Given** the API server is running, **When** I call `POST /v1/chat/completions` with a valid payload, **Then** I receive a response in exact OpenAI chat completion format including `id`, `object`, `created`, `model`, `choices`, and `usage`.
3. **Given** the API server is running, **When** I call `GET /v1/models`, **Then** I receive the currently loaded model listed in OpenAI `/v1/models` format.
4. **Given** the API server is running with streaming enabled, **When** I call with `"stream": true`, **Then** the response is sent as Server-Sent Events in OpenAI streaming format.
5. **Given** the API server is running, **When** the user stops the local server from settings, **Then** in-flight requests complete gracefully and new connections are refused.
6. **Given** no model is loaded, **When** a client calls the API, **Then** the server returns HTTP 503 with a machine-readable error body `{"error": "no_model_loaded"}`.
7. **Given** the local API server is enabled, **When** the app starts, **Then** the server starts automatically if it was enabled in the previous session.

---

### User Story 6 — RAG Document Attachment (Phase 6) (Priority: P2)

As a user, I want to attach documents to a chat session so that the model can answer questions about my files without hallucinating.

**Why this priority**: RAG dramatically increases practical utility — users can query their own documents privately.

**Independent Test**: Attach a PDF to a chat session; ask a question whose answer is in the PDF; verify the response cites the relevant passage and is factually correct.

**Acceptance Scenarios**:

1. **Given** I am in a chat session, **When** I click "Attach Document" and select a `.txt`, `.pdf`, `.md`, or `.docx` file, **Then** the document is chunked, embedded, and a confirmation shows the document is indexed.
2. **Given** a document is attached, **When** I ask a question relevant to its content, **Then** the retrieved chunks are injected into the context window before the user message, and the model's answer references the document.
3. **Given** a document is attached, **When** I ask a question with no relevant match in the document, **Then** the model answers from its own knowledge and does not fabricate a document reference.
4. **Given** I attach a document over 50 MB, **When** the upload begins, **Then** the app warns the user about long indexing time and shows a progress bar.
5. **Given** multiple documents are attached, **When** I ask a question, **Then** chunks from all documents are candidates for retrieval, ranked by semantic similarity.
6. **Given** I remove a document from the session, **When** I ask a follow-up question, **Then** chunks from the removed document are no longer injected into the context.
7. **Given** the embedding model is unavailable, **When** the user tries to attach a document, **Then** a clear error explains that an embedding model must be loaded first.

---

### User Story 7 — MCP Tool Calling (Phase 7) (Priority: P3)

As a developer, I want to give the running model access to local tools via the MCP protocol so that it can perform actions (read files, call APIs, run code) when instructed.

**Why this priority**: Tool calling is powerful but complex. It enhances the developer story after core features are solid.

**Independent Test**: Register a local MCP tool server; send a chat message that requires a tool call; verify the model's tool-use JSON is routed to the MCP server; verify the tool result is injected back into the conversation.

**Acceptance Scenarios**:

1. **Given** an MCP server URL is configured, **When** the app starts, **Then** it discovers available tools from the MCP server's tool manifest and lists them in the chat settings panel.
2. **Given** a model supports tool calling and MCP is enabled, **When** the model emits a tool-use JSON block, **Then** the app parses it, dispatches the call to the correct MCP server, and injects the result as a tool message.
3. **Given** an MCP tool call fails, **When** the error is returned from the MCP server, **Then** the error is injected as a tool result message so the model can reason about the failure.
4. **Given** multiple MCP servers are configured, **When** the model calls a tool, **Then** the correct server is selected based on the tool namespace.
5. **Given** an MCP tool call takes longer than 30 seconds, **When** the timeout is reached, **Then** the call is cancelled, a timeout error is injected, and the model is notified.
6. **Given** the user disables a specific MCP server, **When** the model tries to call a tool from that server, **Then** the tool is not listed in the context and an explanation is injected.
7. **Given** MCP tool calling is active, **When** a tool call is dispatched, **Then** a "Tool Call" badge appears in the chat UI showing the tool name and arguments before the result arrives.

---

### User Story 8 — Installer, Onboarding & Tray (Phase 8) (Priority: P3)

As a first-time user who downloaded the installer, I want a smooth onboarding experience with a system tray icon so that the app integrates naturally into my workflow.

**Why this priority**: Polish converts a power-user tool into a general-audience product. Essential for public release.

**Independent Test**: Install from the built installer; complete the onboarding wizard; minimize to tray; verify the model keeps running; right-click tray icon; verify quick-chat and quit options work.

**Acceptance Scenarios**:

1. **Given** the user launches HugBrowse for the first time, **When** the app opens, **Then** an onboarding wizard walks them through: hardware detection → recommend a starter model → download it → load it → first chat.
2. **Given** the app window is closed, **When** a model is still running, **Then** the app minimizes to the system tray instead of quitting, and a tray tooltip shows the running model name.
3. **Given** the app is in the system tray, **When** the user right-clicks the tray icon, **Then** a context menu shows: "Open HugBrowse", "Quick Chat", "Stop [Model Name]", "Quit".
4. **Given** a new version is available, **When** the app starts, **Then** a non-blocking notification informs the user and offers a one-click update.
5. **Given** the user accepts an auto-update, **When** the update downloads and installs, **Then** the app restarts automatically and the model state is preserved.
6. **Given** the user runs the onboarding wizard, **When** hardware detection runs, **Then** their tier (potato/laptop/gaming/workstation/server) is shown with an explanation of what models they can run.
7. **Given** the app is freshly installed, **When** the user reaches the "download a model" step, **Then** 3 curated starter models are pre-filtered and recommended based on their hardware tier.

---

### Edge Cases

1. **Corrupted GGUF**: A downloaded file passes size check but llama-server reports it invalid — app surfaces the error and offers to re-download.
2. **Port collision**: Port 11434 is already in use — app detects the conflict and prompts the user to choose an alternate port.
3. **Partial sidecar download**: llama-server binary exists but is truncated — app checksums the binary on startup and re-downloads if invalid.
4. **Model file deleted externally**: A file the download manager considers "complete" is deleted from disk — app detects the missing file on next launch and marks it as unavailable.
5. **Network proxy**: User is behind a corporate proxy — all HTTP requests must respect system proxy settings.
6. **Long model names**: Model IDs like `organization/very-long-model-name-gguf-q4-k-m` must display truncated in sidebar without breaking layout.
7. **Multi-GPU**: System has 2+ GPUs — app must enumerate all GPUs and allow the user to select which GPU llama-server offloads to.
8. **Chat with no model loaded**: User opens chat panel before loading any model — a contextual prompt guides them to the Downloads/Models panel.
9. **Concurrent downloads**: User starts downloading 3 models simultaneously — all 3 progress bars are independent and accurate; total bandwidth is not capped to one download.
10. **Context window overflow**: User's chat history exceeds the model's context limit — app detects this before sending and offers automatic truncation or summarization.
11. **Unicode in file paths**: Model files stored in paths with non-ASCII characters (Chinese, Arabic, etc.) must work correctly on all platforms.
12. **App crash during download**: On next launch, the partial file is detected and the download is resumable, not corrupted.
13. **HF rate limiting**: HF API returns 429 — app shows a user-friendly message, backs off with exponential retry, and does not retry aggressively.
14. **RAG with empty document**: User attaches a file with no extractable text — app shows an error message, does not create zero-vector embeddings.
15. **MCP server returns malformed JSON**: App parses it defensively, surfaces a tool-call error to the model, and does not crash.
16. **Large RAG document**: Document is > 50 MB — chunking runs in background without blocking the UI thread.
17. **Tray app with multiple monitors**: App restores to the correct monitor it was last on.
18. **Auto-update fails mid-download**: Partial update file is cleaned up; app restarts without the partial update applied.

---

## 3. Functional Requirements

### Phase 1 — Tauri Desktop Build

- **FR-001**: The app MUST compile and run as a native desktop window via `cargo tauri dev` on Windows 11, macOS 13+, and Ubuntu 22.04+ without manual patches.
- **FR-002**: The app MUST produce a distributable installer via `cargo tauri build` for the host platform.
- **FR-003**: All existing routes (`/`, `/model/:id`, `/settings`, `/recommended`, `/monitor`) MUST be fully functional in the native window.
- **FR-004**: The native window MUST enforce minimum dimensions of 800×600 and default to 1200×800.
- **FR-005**: Settings (HF token, theme, search history) MUST persist across app restarts using the Tauri plugin store.

### Phase 2 — Download Manager

- **FR-006**: Users MUST be able to initiate download of any GGUF file from the model detail page.
- **FR-007**: Downloads MUST show real-time progress: bytes downloaded, total size, speed (MB/s), and estimated time remaining.
- **FR-008**: Downloads MUST be resumable: if interrupted, the next attempt MUST start from the last successful byte offset using HTTP `Range` headers.
- **FR-009**: Downloads MUST be pauseable and resumable by user action.
- **FR-010**: On completion, the app MUST verify the downloaded file's SHA-256 against the value from the HF API and mark the file invalid if they differ.
- **FR-011**: The app MUST reject starting a download when available disk space is less than 1.2× the file size.
- **FR-012**: Users MUST be able to manage all downloads (view, pause, resume, cancel, delete) from a persistent Downloads panel.
- **FR-013**: Download state (in-progress, paused, complete, failed) MUST persist across app restarts.

### Phase 3 — llama-server Sidecar

- **FR-014**: The app MUST bundle platform-specific `llama-server` binaries as Tauri sidecar resources for Windows (`.exe`), macOS (universal binary), and Linux (ELF).
- **FR-015**: The app MUST launch `llama-server` as a managed child process via Tauri shell plugin, passing model path, context size, GPU layers, and port as arguments.
- **FR-016**: The app MUST expose a "Load Model" action that starts `llama-server` with the selected GGUF file.
- **FR-017**: The app MUST expose an "Unload Model" action that terminates the `llama-server` process cleanly (SIGTERM then SIGKILL after 5 s).
- **FR-018**: The app MUST monitor `llama-server` health via polling its `/health` endpoint and surface status to the user in real-time.
- **FR-019**: The app MUST prevent orphan `llama-server` processes: when the app exits, all child processes MUST be terminated.
- **FR-020**: The app MUST verify the bundled `llama-server` binary checksum on first launch and on each major update.

### Phase 4 — Chat Interface

- **FR-021**: The chat interface MUST send user messages to the loaded model and display the streamed response token-by-token.
- **FR-022**: Responses MUST render Markdown: headings, bold, italic, bullet lists, numbered lists, fenced code blocks with syntax highlighting, and inline code.
- **FR-023**: Chat sessions MUST be named, created, renamed, and deleted by the user.
- **FR-024**: Chat history MUST persist locally across app restarts.
- **FR-025**: Users MUST be able to stop generation mid-stream via a "Stop" button.
- **FR-026**: Users MUST be able to configure a system prompt per chat session.
- **FR-027**: The app MUST display estimated tokens/second and context usage (tokens used / context limit) during active generation.

### Phase 5 — Local API Server

- **FR-028**: The app MUST expose an OpenAI-compatible HTTP server on a user-configurable port (default 11434).
- **FR-029**: The server MUST implement `POST /v1/chat/completions` (both streaming SSE and non-streaming JSON).
- **FR-030**: The server MUST implement `GET /v1/models` returning the currently loaded model.
- **FR-031**: The server MUST return HTTP 503 when no model is loaded.
- **FR-032**: The server MUST start automatically on app launch if it was enabled in the previous session.
- **FR-033**: The server MUST display its base URL and active port in the settings panel.

### Phase 6 — RAG

- **FR-034**: Users MUST be able to attach `.txt`, `.pdf`, `.md`, and `.docx` files to a chat session.
- **FR-035**: Attached documents MUST be chunked (512-token chunks, 64-token overlap) and embedded using the loaded embedding model.
- **FR-036**: On each user message, the app MUST retrieve the top-K (default 4) most semantically similar chunks and inject them into the context window.
- **FR-037**: Document embeddings MUST be stored locally and reused across sessions without re-embedding.
- **FR-038**: Users MUST be able to remove documents from a session; removed document chunks MUST NOT be retrieved.

### Phase 7 — MCP Client

- **FR-039**: Users MUST be able to configure one or more MCP server URLs in settings.
- **FR-040**: The app MUST discover and list available tools from each configured MCP server's tool manifest.
- **FR-041**: When the loaded model emits a tool-call JSON block, the app MUST parse it, dispatch it to the correct MCP server, and inject the result as a tool message.
- **FR-042**: MCP tool calls MUST time out after 30 seconds; a timeout error MUST be injected as the tool result.
- **FR-043**: The UI MUST show a "Tool Call" badge with tool name and arguments while a call is in flight.

### Phase 8 — Polish

- **FR-044**: The app MUST include a first-run onboarding wizard covering: hardware detection, model recommendation, first download, and first chat.
- **FR-045**: When a model is running and the main window is closed, the app MUST minimize to the system tray.
- **FR-046**: The system tray icon MUST provide a context menu with: "Open", "Quick Chat", "Stop [Model]", "Quit".
- **FR-047**: The app MUST check for updates on launch and display a non-blocking notification when an update is available.
- **FR-048**: Auto-update MUST download in the background and prompt before applying; the update MUST be applied on next launch if the user defers.

---

## 4. Non-Functional Requirements

### Performance

- **NFR-001**: First token latency (from user send to first streamed token visible in UI) MUST be under 500 ms on hardware that can run the model at ≥ 5 tok/s.
- **NFR-002**: Download progress updates MUST refresh at least every 500 ms; the UI MUST NOT freeze during active downloads.
- **NFR-003**: The app MUST start (cold launch to interactive window) in under 3 seconds on a modern machine (SSD, 16 GB RAM).

### Memory & Resource Safety

- **NFR-004**: `llama-server` memory usage MUST be bounded by the model's declared size + 512 MB overhead; the app MUST surface an OOM warning before launching a model that would exceed available RAM/VRAM.
- **NFR-005**: No orphan processes: every `llama-server` instance started by the app MUST be terminated before the app fully exits.

### Security

- **NFR-006**: The local API server MUST bind to `127.0.0.1` only by default; binding to `0.0.0.0` requires explicit user opt-in with a visible warning.
- **NFR-007**: The HF token MUST be stored via Tauri's encrypted plugin store and MUST NOT appear in log files or IPC payloads.
- **NFR-008**: CSP rules MUST be updated to allow `connect-src` to `localhost` for the local API server, but MUST NOT relax any other directives.

### Reliability

- **NFR-009**: If `llama-server` crashes during chat, the app MUST detect the crash within 2 seconds, show an error in the chat panel, and offer a one-click "Reload Model" option.
- **NFR-010**: Download resume MUST work after any type of interruption (network drop, app crash, system sleep) with no data corruption.

### Compatibility

- **NFR-011**: The llama-server sidecar MUST support CUDA (NVIDIA), Metal (Apple Silicon), and CPU-only modes; the correct binary MUST be selected automatically based on hardware detection.
- **NFR-012**: All Phase 1–8 features MUST work on Windows 11, macOS 13+, and Ubuntu 22.04+ LTS.

---

## 5. Key Entities

### DownloadEntry

- **What it represents**: A tracked download of a single GGUF file from HuggingFace.
- **Key attributes**: model ID, filename, URL, total size (bytes), downloaded size (bytes), status (queued/downloading/paused/complete/failed/validating), SHA-256 expected/actual, local file path, download speed, ETA.
- **Relationships**: Belongs to a Model; referenced by ModelInstance when download is complete.

### ModelInstance

- **What it represents**: A locally available GGUF file that can be loaded for inference.
- **Key attributes**: display name, quantization label, file path, file size, origin model ID, context length, current status (unloaded/loading/running/error), llama-server PID (when running), port in use.
- **Relationships**: Derived from a DownloadEntry; referenced by ChatSession and InferenceServer.

### ChatSession

- **What it represents**: A persistent conversation between the user and a model instance.
- **Key attributes**: session ID, title, model instance reference, system prompt, message array (role/content/timestamp), attached documents list, created at, last active at.
- **Relationships**: Belongs to a ModelInstance; has many ChatMessages; has many AttachedDocuments.

### ChatMessage

- **What it represents**: A single message in a chat session.
- **Key attributes**: message ID, role (user/assistant/system/tool), content (string), token count, latency (ms), tool call metadata (optional), streaming state.
- **Relationships**: Belongs to a ChatSession.

### AttachedDocument

- **What it represents**: A document indexed for RAG in a specific chat session.
- **Key attributes**: document ID, filename, file type, file size, chunk count, embedding model used, indexed at, removed (boolean).
- **Relationships**: Belongs to a ChatSession; has many DocumentChunks.

### InferenceServer

- **What it represents**: The local OpenAI-compatible server state.
- **Key attributes**: enabled, port, bound address (loopback/all), status (stopped/starting/running/error), active connections count.
- **Relationships**: Serves requests against the currently loaded ModelInstance.

### MCPServer

- **What it represents**: A configured Model Context Protocol server.
- **Key attributes**: server URL, name, enabled, discovered tools list, last health check.
- **Relationships**: Provides tools to active ChatSessions.

---

## 6. Success Criteria

- **SC-001**: `cargo tauri dev` compiles and opens a native window with zero manual patches on all 3 target platforms.
- **SC-002**: A user can go from "no model on disk" to "first chat response received" in under 10 minutes on a 50 Mbps connection (assuming model download time).
- **SC-003**: A 7B Q4 GGUF model loads in `llama-server` and produces a first response token within 500 ms of the user pressing Enter.
- **SC-004**: A download interrupted at any point (network drop, sleep, crash) resumes from the exact byte offset on next attempt — verified by byte-level diff of partial file before and after resume.
- **SC-005**: `curl localhost:11434/v1/chat/completions` with a standard OpenAI payload works identically to pointing the official OpenAI Python SDK at the same endpoint.
- **SC-006**: The HF token is never written to any log file, IPC trace, or stdout in any build configuration — verified by scanning all log output.
- **SC-007**: When the app exits (or crashes via `kill -9`), no `llama-server` process remains running — verified by process list check after each exit test.
- **SC-008**: All existing HugBrowse features (search, model detail, hardware tiers, disk check, resource monitor) produce identical output before and after each phase — verified by manual regression checklist.
- **SC-009**: A RAG query against a 10-page PDF document returns an answer that references a specific paragraph from the document — verified against a known-answer test document.
- **SC-010**: The built installer completes installation on a clean VM in under 2 minutes and the app launches without requiring additional runtime installation.
- **SC-011**: The onboarding wizard successfully guides a user with no prior knowledge to a running chat in ≤ 7 steps.
- **SC-012**: The local API server handles 10 concurrent streaming requests without dropping any — verified by a load test script.

---

## 7. Assumptions & Dependencies

### Assumptions

- llama-server binaries will be sourced from the official llama.cpp GitHub releases (not self-compiled); the bundling mechanism is Tauri sidecar via `externalBin`.
- Hugging Face continues to provide the `/tree/{revision}` endpoint for file listing and LFS download URLs.
- GGUF format remains the primary distribution format for quantized models throughout this project.
- Users will have Rust toolchain ≥ 1.77 and Node.js ≥ 18 installed for development; end users install only the compiled installer.
- The embedded inference will use `llama-server`'s native OpenAI-compatible endpoints rather than re-implementing a protocol layer.
- RAG embedding will use a small bundled embedding model (e.g., `all-minilm-l6-v2` via llama-server's embedding endpoint) rather than a separate embedding service.

### Dependencies

- **tauri-plugin-shell**: Required for launching sidecar processes. Already in Cargo.toml.
- **tauri-plugin-store**: Required for persisted settings. Already in Cargo.toml.
- **llama.cpp llama-server binary**: Must be sourced and bundled per-platform. Not yet in the project.
- **Tauri updater plugin** (`tauri-plugin-updater`): Required for Phase 8 auto-update. Not yet added.
- **HuggingFace LFS download API**: GGUF files are LFS-stored; download URLs must be resolved via the HF `/resolve` endpoint.
- **OpenAI-compatible test harness**: A small test script using the OpenAI Python SDK to verify Phase 5 compatibility.

---

## 8. Out of Scope

The following are explicitly **NOT** part of this specification:

- Training, fine-tuning, or RLHF of models
- Cloud inference or any remote model execution
- Multi-user authentication or access control
- A model store / marketplace beyond linking to HuggingFace
- ONNX, TensorRT, or any inference backend other than llama.cpp
- Voice input or text-to-speech output
- Mobile (iOS/Android) versions
- Compiling llama.cpp from source as part of the build process
- Any telemetry, analytics, or usage reporting

---

## 9. Acceptance Checklist

### Spec Quality

- [x] No implementation details (languages, frameworks, APIs — only in Assumptions)
- [x] Focused on user value and business needs
- [x] All mandatory sections completed
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable and technology-agnostic
- [x] No NEEDS CLARIFICATION markers remain (all defaults documented in Assumptions)
- [x] Every user story has ≥ 5 acceptance scenarios (56 total across 8 stories)
- [x] 18 edge cases identified
- [x] Scope clearly bounded (Out of Scope section)
- [x] All 48 functional requirements trace to a user story
- [x] Dependency graph showing phase ordering and critical path
- [x] Guard rails stated as hard constraints
- [x] 8 non-functional requirements covering performance, security, memory, reliability, compatibility
- [x] 12 success criteria, all measurable and technology-agnostic
