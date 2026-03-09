# HugBrowse v0.5 — Critical Fixes Specification

**Version**: 0.5.0  
**Status**: Draft  
**Date**: 2026-03-09  
**Author**: SDD Pipeline (spec-writer)

---

## 1. Project Overview

**What**: Fix 5 critical bugs preventing core HugBrowse functionality from working — downloads, model loading, GPU monitoring, and UI layout.

**Why**: The application currently cannot download models, cannot connect to Ollama, displays incorrect VRAM, and has poor layout on model detail pages. These are blocking issues that prevent basic usage.

**For Whom**: End users who want to browse, download, and run AI models locally.

---

## 2. User Scenarios & Stories

### User Story 1 — Fix Tauri IPC Parameter Naming (Priority: P1)

All Tauri invoke calls with multi-word parameter names use `snake_case` keys, but Tauri v2's `#[tauri::command]` macro auto-generates argument structs with `#[serde(rename_all = "camelCase")]`. This silently breaks every command with multi-word parameters — downloads, backend management, model loading, chat, and more.

**Why this priority**: This is the root cause of downloads not working, Ollama connect failing, model loading failing, and chat not functioning. Fixing this unblocks ALL core features.

**Independent Test**: Call `add_backend` with camelCase params and verify it succeeds without "missing required key" error.

**Acceptance Scenarios**:
1. **Given** user clicks "Connect" on an Ollama model, **When** the app invokes `add_backend`, **Then** connection succeeds without "missing required key backendType" error
2. **Given** user clicks "Download" on a GGUF file, **When** the app invokes `start_download`, **Then** download begins successfully
3. **Given** user loads a model in chat, **When** the app invokes `load_model`, **Then** model loads without IPC errors
4. **Given** user sends a chat message, **When** the app invokes `proxy_chat_completions`, **Then** chat response streams back

**Affected invoke calls** (13 total):
| Command | Snake_case key | CamelCase fix |
|---------|---------------|---------------|
| `add_backend` | `api_key` | `apiKey` |
| `add_backend` | `backend_type` | `backendType` |
| `start_download` | `model_id` | `modelId` |
| `start_download` | `dest_dir` | `destDir` |
| `start_download` | `total_bytes` | `totalBytes` |
| `start_download` | `expected_sha256` | `expectedSha256` |
| `start_download` | `auth_token` | `authToken` |
| `delete_download_entry` | `delete_file` | `deleteFile` |
| `test_backend_connection` | `api_key` | `apiKey` |
| `save_backend_credential` | `backend_id` | `backendId` |
| `save_backend_credential` | `api_key` | `apiKey` |
| `deploy_hf_endpoint` | `model_id` | `modelId` |
| `deploy_hf_endpoint` | `instance_type` | `instanceType` |
| `deploy_hf_endpoint` | `hf_token` | `hfToken` |
| `check_hf_endpoint_status` | `backend_id` | `backendId` |
| `pause_hf_endpoint` | `backend_id` | `backendId` |
| `resume_hf_endpoint` | `backend_id` | `backendId` |
| `delete_hf_endpoint` | `backend_id` | `backendId` |
| `proxy_chat_completions` | `messages_json` | `messagesJson` |
| `load_model` | `model_path` | `modelPath` |
| `load_model` | `model_name` | `modelName` |
| `load_model` | `ctx_size` | `ctxSize` |
| `load_model` | `n_gpu_layers` | `nGpuLayers` |
| `load_model` | `gpu_device` | `gpuDevice` |
| `check_model_memory` | `model_path` | `modelPath` |

---

### User Story 2 — Fix VRAM Detection for GPUs >4GB (Priority: P1)

The VRAM total is queried via `wmic path win32_VideoController get AdapterRAM`, which returns a 32-bit DWORD. For GPUs with more than ~4.3GB VRAM (like the AMD RX 7700 XT with 12GB), this value overflows and reports incorrect amounts.

**Why this priority**: Incorrect VRAM reporting makes the resource monitor unreliable and memory-fit checks wrong.

**Independent Test**: On a system with >4GB VRAM GPU, verify VRAM total displays correctly (e.g., 12.0 GB for RX 7700 XT).

**Acceptance Scenarios**:
1. **Given** user has an AMD RX 7700 XT (12GB VRAM), **When** resource monitor loads, **Then** VRAM total shows 12.0 GB (not 4.0 GB or 0 GB)
2. **Given** user has an NVIDIA GPU with >4GB VRAM, **When** resource monitor loads, **Then** VRAM total is correct
3. **Given** VRAM query fails, **When** resource monitor renders, **Then** it shows "N/A" gracefully

---

### User Story 3 — Add Download Button to Model Overview (Priority: P1)

When users click on a model, they land on the README tab which has no download button. The download button only appears in the Files tab for GGUF files. Users expect a prominent download action on the main view.

**Why this priority**: Users cannot discover how to download models — the primary feature of the app.

**Independent Test**: Navigate to any model detail page and verify a download CTA is visible without switching tabs.

**Acceptance Scenarios**:
1. **Given** user navigates to a model detail page, **When** the page loads (README tab), **Then** a prominent "Download" section or button is visible showing available GGUF files
2. **Given** model has multiple GGUF files, **When** user sees the download section, **Then** they can choose which quantization/variant to download
3. **Given** model has no GGUF files, **When** user views the download section, **Then** it shows a message like "No downloadable GGUF files available"

---

### User Story 4 — Fix Model Detail Page Layout (Priority: P2)

The model detail page has `max-w-5xl` (64rem / ~896px) constraining content to the left portion of the screen, leaving over half the screen as empty whitespace on wide monitors.

**Why this priority**: Poor use of screen real estate hurts the browsing experience.

**Independent Test**: On a 1920px+ wide screen, model detail page content should fill the available width.

**Acceptance Scenarios**:
1. **Given** user views a model detail page on a wide screen (1920px+), **When** page renders, **Then** content uses the full available width
2. **Given** user views model detail on a narrow screen (< 1024px), **When** page renders, **Then** content remains readable and doesn't overflow

---

### User Story 5 — Speed Up Resource Monitor Updates (Priority: P3)

The resource monitor spawns a new PowerShell process every 2 seconds to query GPU metrics via `Get-CimInstance`. This is slow and creates noticeable update lag.

**Why this priority**: Polish — monitor should feel responsive and real-time.

**Independent Test**: Resource monitor GPU values update within 1 second of actual GPU load change.

**Acceptance Scenarios**:
1. **Given** resource monitor is open, **When** GPU load changes, **Then** the displayed values update within 1 second
2. **Given** system is idle, **When** resource monitor polls, **Then** each poll completes in under 500ms

---

## 3. Functional Requirements

### Story 1 — IPC Parameter Fix
- **FR-001**: System MUST use camelCase parameter names in ALL Tauri invoke calls to match Tauri v2's auto-generated serde deserialization
- **FR-002**: System MUST successfully invoke `add_backend` with `backendType` parameter
- **FR-003**: System MUST successfully invoke `start_download` with `modelId`, `destDir`, `totalBytes`, `expectedSha256`, `authToken` parameters
- **FR-004**: System MUST successfully invoke `load_model` with `modelPath`, `modelName`, `ctxSize`, `nGpuLayers`, `gpuDevice` parameters
- **FR-005**: System MUST successfully invoke `proxy_chat_completions` with `messagesJson` parameter

### Story 2 — VRAM Detection
- **FR-006**: System MUST query VRAM total using a method that supports values >4GB (not limited to 32-bit DWORD)
- **FR-007**: System MUST display correct VRAM total for GPUs with 4GB, 8GB, 12GB, 16GB, and 24GB VRAM
- **FR-008**: System SHOULD cache VRAM total for the session (GPU VRAM doesn't change at runtime)

### Story 3 — Download CTA
- **FR-009**: System MUST display a download section on the model detail overview (README tab)
- **FR-010**: System MUST list available GGUF files with size and quantization info in the download section
- **FR-011**: System MUST allow one-click download of any listed GGUF file from the overview
- **FR-012**: System SHOULD show "No GGUF files" message when model has no downloadable files

### Story 4 — Layout Fix
- **FR-013**: Model detail page MUST use full available width (no artificial max-width constraint)
- **FR-014**: Model detail page MUST remain readable on screens from 768px to 3840px wide

### Story 5 — Monitor Speed
- **FR-015**: Resource monitor SHOULD poll at 1-second intervals instead of 2 seconds
- **FR-016**: GPU metric collection SHOULD complete within 500ms per poll

---

## 4. Non-Functional Requirements

- **NFR-001**: All invoke call fixes MUST be backward-compatible (no Rust backend changes required for IPC fix)
- **NFR-002**: VRAM detection MUST work on Windows 10 and Windows 11
- **NFR-003**: Download CTA MUST be visually prominent and follow existing design system
- **NFR-004**: All existing 127 tests MUST continue to pass after changes

---

## 5. Edge Cases & Error Handling

- **EC-001**: If VRAM query returns 0 or negative, display "N/A" instead of incorrect value
- **EC-002**: If model has zero files (API error), download section shows graceful empty state
- **EC-003**: If Ollama connect fails after IPC fix, error message should be user-friendly
- **EC-004**: If PowerShell GPU query times out, use last known good values

---

## 6. Assumptions & Dependencies

- Tauri v2.10.3 uses `#[serde(rename_all = "camelCase")]` on auto-generated command argument structs (confirmed)
- AMD RX 7700 XT has 12GB VRAM (user confirmed)
- Windows `Win32_VideoController` WMI class is available on user's system
- Existing Rust backend commands are correct and don't need changes (only frontend invoke keys change)

---

## 7. Out of Scope

- Rust backend changes for IPC (all IPC fixes are frontend-only)
- New features (model import, cloud offload, etc.)
- Linux/macOS compatibility
- Adding new test files (maintain existing 127 tests passing)

---

## 8. Success Criteria

- **SC-001**: User can click "Connect" on an Ollama model and it connects without error
- **SC-002**: User can download a GGUF model file from the model detail page overview tab
- **SC-003**: Resource monitor shows correct VRAM total (12.0 GB for RX 7700 XT)
- **SC-004**: Model detail page content fills the full screen width
- **SC-005**: All 127 existing tests pass
- **SC-006**: Chat works end-to-end: send message → receive streamed response
