# Implementation Tasks: HugBrowse — LM Studio Competitor

**Spec**: `.specify/specs/hugbrowse-lm-studio/spec.md`
**Created**: 2026-03-07
**Status**: In Progress

---

## Phase 1: Verify Tauri Build (US1 — Native Desktop Window)

> **Goal**: Confirm `cargo tauri dev` compiles without patches; all existing routes work.
> **Independent Test**: Run `npm run tauri:dev`; native 1200×800 window opens with search UI.

- [x] T001 [US1] Verify existing Tauri setup compiles — `src-tauri/Cargo.toml`, `tauri.conf.json`
- [x] T002 [US1] Confirm all 5 routes (`/`, `/model/:id`, `/recommended`, `/monitor`, `/settings`) resolve in the native window
- [x] T003 [US1] Verify Tauri Store persists HF token across restarts — `src/stores/settings.ts`
- [x] T004 [US1] Confirm minimum window size constraint (800×600) is enforced — `tauri.conf.json`

**Checkpoint**: All existing features work in native window ☑

---

## Phase 2: Download Manager (US2 — Download GGUF Models)

> **Goal**: Users can download GGUF files with live progress, pause, resume, SHA-256 verify.
> **Independent Test**: Click Download on a GGUF file; see live progress bar; file on disk after completion.

### Rust Backend

- [x] T005 [US2] Add `reqwest`, `tokio`, `futures-util`, `sha2`, `hex`, `uuid` to `src-tauri/Cargo.toml`
- [x] T006 [US2] Create `src-tauri/src/download.rs` — `DownloadEntry`, `DownloadManagerState`, `do_download` async task
- [x] T007 [US2] Implement `start_download` command — range-header resumability, progress events, disk-space check
- [x] T008 [US2] Implement `pause_download`, `resume_download`, `cancel_download`, `get_downloads`, `delete_download_entry` commands
- [x] T009 [US2] Update `src-tauri/src/lib.rs` — register download module and managed state

### TypeScript

- [x] T010 [US2] Create `src/stores/downloads.ts` — Zustand store, Tauri event listener for `download-progress`
- [x] T011 [US2] Create `src/components/download/DownloadItem.tsx` — progress bar, pause/resume/cancel buttons
- [x] T012 [US2] Create `src/components/download/DownloadPanel.tsx` — list of all downloads
- [x] T013 [US2] Update `src/pages/ModelDetailPage.tsx` — add Download buttons for GGUF files in the Files tab

**Checkpoint**: Download a real GGUF file; progress bar shows; file on disk; SHA-256 validated ☑

---

## Phase 3: llama-server Sidecar (US3 — Load and Run Models)

> **Goal**: Load a downloaded GGUF file via bundled llama-server; show status; unload cleanly.
> **Independent Test**: Click Load → llama-server starts → `/health` returns OK → click Unload → process terminates.

### Rust Backend

- [x] T014 [US3] Update `src-tauri/tauri.conf.json` — add `bundle.externalBin: ["binaries/llama-server"]` and shell plugin scope
- [x] T015 [US3] Update `src-tauri/capabilities/default.json` — add `shell:allow-execute`, `shell:allow-kill`
- [x] T016 [US3] Create `src-tauri/src/inference.rs` — `InferenceState`, `InferenceManager`, managed Arc<Mutex<>>
- [x] T017 [US3] Implement `load_model` command — spawn sidecar, poll `/health`, return status
- [x] T018 [US3] Implement `unload_model`, `get_inference_status` commands
- [x] T019 [US3] Update `src-tauri/src/lib.rs` — register inference module; terminate child on app exit

### TypeScript

- [x] T020 [US3] Create `src/stores/inference.ts` — Zustand store; `loadModel`, `unloadModel`, `refreshStatus`
- [x] T021 [US3] Create `src/components/models/ModelRunPanel.tsx` — Load/Unload button, status indicator, memory warning

**Checkpoint**: Load llama-server with a real GGUF; status shows Running; Unload terminates process ☑

---

## Phase 4: Chat Interface (US4 — Chat with Running Models)

> **Goal**: Streaming chat with markdown rendering, sessions, persist across restarts.
> **Independent Test**: Send message → tokens stream in real-time → markdown renders → session persists after restart.

- [x] T022 [US4] Create `src/stores/chat.ts` — Zustand+persist; sessions, streaming SSE via fetch
- [x] T023 [US4] Create `src/components/chat/SessionSidebar.tsx` — session list, create/rename/delete
- [x] T024 [US4] Create `src/components/chat/ChatMessage.tsx` — markdown render (ReactMarkdown + remark-gfm), code blocks with copy
- [x] T025 [US4] Create `src/components/chat/ChatInput.tsx` — textarea, Enter to send, Shift+Enter newline, Stop button
- [x] T026 [US4] Create `src/pages/ChatPage.tsx` — full layout: session sidebar + message list + input
- [x] T027 [US4] Update `src/App.tsx` — add `/chat` route; wrap in ErrorBoundary
- [x] T028 [US4] Update `src/components/layout/Header.tsx` — add Chat nav link with MessageSquare icon
- [x] T029 [US4] Update `src-tauri/tauri.conf.json` CSP — allow `http://127.0.0.1:*` in `connect-src`

**Checkpoint**: Chat with a running model; response streams; code blocks render; session survives restart ☑

---

## Phase 5: Local API Server (US5 — OpenAI-Compatible API)

> llama-server already exposes OpenAI-compatible endpoints on its port. Phase 5 is: settings UI + documentation.

- [x] T030 [US5] Update `src/stores/inference.ts` — expose `port`, `apiEnabled` toggle
- [x] T031 [US5] Create `src/components/models/ApiServerPanel.tsx` — show base URL, copy button, port config
- [x] T032 [US5] Update `src/pages/SettingsPage.tsx` — add API Server section with enable toggle and port input

**Checkpoint**: API server panel shows correct URL; `curl localhost:{port}/v1/models` returns model list ☑

---

## Phase 6: RAG Document Attachment (US6) — Scaffold

> Requires embedding model. Scaffold the UI; wire to llama-server `/embedding` when available.

- [x] T033 [US6] Create `src/stores/rag.ts` — document list, chunk status per session (Zustand+persist)
- [x] T034 [US6] Create `src/components/chat/RagPanel.tsx` — attach document button, indexed document list, remove button
- [x] T035 [US6] Update `src/stores/chat.ts` — inject RAG context into messages before send

**Checkpoint**: RAG panel visible in chat; attach/remove document UI functional (embedding wired when model supports it) ☑

---

## Phase 7: MCP Client (US7) — Scaffold

> `src/lib/mcp-client.ts` already exists. Wire it into the chat flow.

- [x] T036 [US7] Create `src/stores/mcp.ts` — server list, tool discovery, Zustand+persist
- [x] T037 [US7] Create `src/components/chat/McpToolBadge.tsx` — in-flight tool call badge
- [x] T038 [US7] Update `src/pages/SettingsPage.tsx` — MCP server management section
- [x] T039 [US7] Update `src/stores/chat.ts` — intercept tool-call JSON, dispatch to MCP, inject result

**Checkpoint**: MCP server URL saved in settings; tool calls dispatched and result injected into conversation ☑

---

## Phase 8: Polish (US8 — Installer, Onboarding, Tray)

- [x] T040 [US8] Create `src/pages/OnboardingPage.tsx` — 4-step wizard: hardware → recommend → download → chat
- [x] T041 [US8] Update `src/stores/settings.ts` — `onboardingComplete` flag
- [x] T042 [US8] Update `src/App.tsx` — show onboarding if `!onboardingComplete`
- [x] T043 [US8] Update `src-tauri/Cargo.toml` — add `tauri-plugin-updater = "2"` for auto-update
- [x] T044 [US8] Update `src-tauri/src/lib.rs` — register updater plugin, check for updates on startup
- [x] T045 [US8] Update `tauri.conf.json` — add system tray / close-to-tray configuration

**Checkpoint**: Onboarding launches on first run; tray icon visible when model is running ☑

---

## Dependencies

```
Phase 1 (Verify Build)
    └──► Phase 2 (Download Manager)  ←  T005-T013
              └──► Phase 3 (Sidecar)   ←  T014-T021
                        ├──► Phase 4 (Chat)       ←  T022-T029
                        │         ├──► Phase 5 (API UI)  ←  T030-T032
                        │         ├──► Phase 6 (RAG)     ←  T033-T035
                        │         └──► Phase 7 (MCP)     ←  T036-T039
                        └──► Phase 8 (Polish)     ←  T040-T045
```

---

## Progress Tracking

| Phase             | Status | Tasks  | Done   | Remaining |
| ----------------- | ------ | ------ | ------ | --------- |
| P1: Verify Build  | ✅     | 4      | 4      | 0         |
| P2: Download Mgr  | ✅     | 9      | 9      | 0         |
| P3: Sidecar       | ✅     | 8      | 8      | 0         |
| P4: Chat UI       | ✅     | 8      | 8      | 0         |
| P5: API Server UI | ✅     | 3      | 3      | 0         |
| P6: RAG           | ✅     | 3      | 3      | 0         |
| P7: MCP           | ✅     | 4      | 4      | 0         |
| P8: Polish        | ✅     | 6      | 6      | 0         |
| **Total**         |        | **45** | **45** | **0**     |
