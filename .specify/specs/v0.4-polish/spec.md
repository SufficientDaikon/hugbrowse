# Feature Specification: HugBrowse v0.4 — Polish, Bugs & Model Import

**Created**: 2026-03-09
**Status**: Draft
**Source**: User-reported bugs, screenshots, and feature requests

---

## 1. Project Overview

### What We're Building

A comprehensive quality pass across HugBrowse that fixes 4 critical bugs and adds a major model import/discovery feature. This spec covers:

1. **Model Import & Discovery** — Easy model loading from Chat page, auto-detection of Ollama/LM Studio models, file picker import
2. **Resource Monitor Overhaul** — Fix AMD GPU detection, accurate real-time metrics for all GPU vendors
3. **README Rendering Fix** — Model detail page shows raw HTML instead of rendered markdown
4. **Files Tab Crash Fix** — TypeError crash when clicking Files tab on model detail page
5. **Layout & Navigation Fix** — Sidebar filters incorrectly persist across all pages; excessive empty space

### Why We're Building It

The app is functionally complete but has usability-breaking bugs. The README renders as raw HTML code, the Files tab crashes entirely, GPU monitoring ignores AMD hardware, users can't load models from the Chat page, and the sidebar wastes space on non-search pages. These issues prevent the app from being usable as a daily driver.

### Who It's For

- **Primary**: AI enthusiasts who already have models downloaded via Ollama or LM Studio and want a unified interface
- **Secondary**: New users exploring Hugging Face models who need a frictionless path from browse → download → chat

---

## 2. User Scenarios & Stories

### User Story 1 — Fix Critical Crashes & Rendering Bugs (Priority: P1)

A user browses a model on HugBrowse, opens the model detail page, and expects to read the README and browse files. Currently the README shows raw HTML source code (unrendered `<a>`, `<img>` tags), and clicking the Files tab crashes with "Cannot read properties of undefined (reading 'toLowerCase')". These two bugs make model inspection unusable.

**Why this priority**: The model detail page is the core feature — users can't evaluate models if they can't read the README or view files. Both bugs are crash-severity.

**Independent Test**: Navigate to any model with an HTML-rich README (e.g., Qwen/Qwen3-0.6B). Verify README renders properly with images and links. Click Files tab and verify file list loads without crashing.

**Acceptance Scenarios**:

1. **Given** a model with HTML content in its README (badges, images, links), **When** the user opens the model detail page, **Then** the README renders with formatted HTML — images display, links are clickable, badges render correctly
2. **Given** a model with a markdown-only README (no HTML), **When** the user opens the model detail page, **Then** the README renders with proper markdown formatting (headers, bold, lists, code blocks)
3. **Given** a model with files listed in the repository, **When** the user clicks the "Files" tab, **Then** the file list displays without errors, showing filenames, sizes, and type indicators
4. **Given** a model where some file objects lack a filename property, **When** the file list renders, **Then** the system gracefully handles missing fields without crashing
5. **Given** any rendered HTML in the README, **When** the page displays, **Then** potentially dangerous content (scripts, iframes, event handlers) MUST be sanitized

---

### User Story 2 — Contextual Layout & Navigation (Priority: P1)

A user navigates between Search, Chat, Monitor, and Settings pages. Currently the sidebar with search filters (Tasks, Libraries) remains visible on ALL pages, consuming ~240px of horizontal space and creating a broken, cluttered experience. Users expect the sidebar to only appear on the Search/Explore page.

**Why this priority**: The sidebar issue affects every single page in the app. It wastes screen real estate and confuses users by showing search filters on the Chat and Monitor pages where they have no function.

**Independent Test**: Navigate to Chat, Monitor, and Settings. Verify no filter sidebar appears. Navigate to Search/Explore. Verify sidebar with filters appears. Verify the main content area uses the full width on non-search pages.

**Acceptance Scenarios**:

1. **Given** the user is on the Search/Explore page (`/`), **When** the page loads, **Then** the sidebar with task and library filters MUST be visible
2. **Given** the user is on any other page (Chat, Monitor, Settings, Model Detail, For You), **When** the page loads, **Then** the sidebar MUST NOT be visible and the main content area MUST use the full available width
3. **Given** the user navigates from Search to Chat, **When** the transition completes, **Then** the sidebar disappears and the Chat page layout fills the screen
4. **Given** the user navigates from Chat back to Search, **When** the transition completes, **Then** the sidebar reappears with the previous filter state preserved
5. **Given** the Chat page, **When** displayed without the sidebar, **Then** the session sidebar (chat history) and main chat area MUST fill the available space without excessive empty areas

---

### User Story 3 — Model Import & Quick-Load from Chat (Priority: P1)

A user opens the Chat page and sees "No Model Running." They already have models downloaded via Ollama and LM Studio on their machine. Currently there's no way to import those models or even navigate to the model browser from the empty state. The user wants a one-click path to get chatting — either by importing existing local models or browsing for new ones.

**Why this priority**: The Chat page is the primary interaction surface. An empty state with no actionable next step is a dead end. Users with existing Ollama/LM Studio models (the primary audience) have no path to use them.

**Independent Test**: Open Chat page with no model loaded. Verify action buttons appear. Click "Import Model" and verify file picker opens. Click "Auto-Detect" and verify Ollama/LM Studio models are discovered.

**Acceptance Scenarios**:

1. **Given** the Chat page with no model loaded, **When** the empty state displays, **Then** it MUST show at least three action buttons: "Browse Models", "Import GGUF File", and "Auto-Detect Local Models"
2. **Given** the user clicks "Browse Models", **When** activated, **Then** the user is navigated to the Search/Explore page
3. **Given** the user clicks "Import GGUF File", **When** activated, **Then** a native file picker opens filtered to `.gguf` files, and upon selection the model is added to the available models list and can be loaded
4. **Given** Ollama is installed and running on the system (default port 11434), **When** the user clicks "Auto-Detect Local Models", **Then** the system discovers all Ollama models and displays them in a selection list with name, size, and quantization info
5. **Given** LM Studio is installed with models in its default directory (`~/.cache/lm-studio/models/`), **When** auto-detection runs, **Then** the system discovers all GGUF files in that directory and lists them as importable models
6. **Given** the user selects a detected model from the auto-detect results, **When** they click "Load", **Then** the model loads into the inference engine and the chat becomes active
7. **Given** no Ollama or LM Studio installation exists, **When** auto-detection runs, **Then** the system displays a friendly message: "No local model servers detected. Import a GGUF file or browse models to download one."

---

### User Story 4 — Accurate Resource Monitor with AMD GPU Support (Priority: P2)

A user with an AMD Radeon RX 7700 XT opens the Resource Monitor. The system correctly identifies the GPU in the hardware info card at the top, but the live gauges show "N/A — No discrete GPU detected" for both GPU and VRAM. The user expects real-time GPU utilization and VRAM usage metrics for their AMD hardware, just as they would get for NVIDIA.

**Why this priority**: The Resource Monitor is a key differentiator for HugBrowse. Showing "No GPU detected" when the GPU IS detected in the header destroys user trust. AMD GPUs represent ~30% of the desktop market.

**Independent Test**: On a system with an AMD GPU, open the Resource Monitor. Verify GPU name, utilization percentage, temperature, and VRAM usage all display correctly in the gauges.

**Acceptance Scenarios**:

1. **Given** a system with an AMD GPU, **When** the Resource Monitor page loads, **Then** the GPU gauge MUST display current GPU utilization as a percentage (not "N/A")
2. **Given** a system with an AMD GPU, **When** the Resource Monitor page loads, **Then** the VRAM gauge MUST display current VRAM usage (used/total) with accurate numbers
3. **Given** a system with an NVIDIA GPU, **When** the Resource Monitor page loads, **Then** GPU and VRAM gauges MUST continue to work correctly (no regression)
4. **Given** a system with Intel integrated graphics only, **When** the Resource Monitor page loads, **Then** the system SHOULD show iGPU utilization if available, or display "Integrated GPU" with a note explaining limited metrics
5. **Given** the Resource Monitor is open, **When** GPU load changes (e.g., model inference starts), **Then** the GPU gauge MUST update within 3 seconds to reflect the new utilization
6. **Given** live resource data updates, **When** new data arrives, **Then** gauge animations MUST be smooth (no flickering, jumping, or layout shifts)
7. **Given** the Resource Monitor page, **When** displaying all metrics, **Then** CPU, RAM, GPU, and VRAM readings MUST match the values reported by the operating system's native tools (Task Manager, GPU-Z) within ±5% tolerance

---

### User Story 5 — Model Import Persistence & Management (Priority: P2)

A user imports a GGUF model file from their local filesystem. After restarting the app, they expect the imported model to still appear in their model list without re-importing.

**Why this priority**: Without persistence, users must re-import models every session — a major friction point that would cause abandonment.

**Independent Test**: Import a GGUF file, close the app, reopen. Verify the imported model appears in the model list.

**Acceptance Scenarios**:

1. **Given** the user has imported a GGUF model file, **When** the app restarts, **Then** the imported model MUST appear in the available models list
2. **Given** the user has multiple imported models, **When** viewing the model list, **Then** each model displays its filename, file size, and import date
3. **Given** an imported model whose source file has been moved or deleted, **When** the user tries to load it, **Then** the system MUST display a clear error: "Model file not found at [path]. Would you like to re-locate it or remove it from the list?"
4. **Given** the user wants to remove an imported model from the list, **When** they click remove, **Then** the model is removed from the list but the original file on disk is NOT deleted

---

### User Story 6 — Resource Monitor Visual Polish (Priority: P3)

The Resource Monitor page should feel premium, with smooth animations, clear visual hierarchy, and dense-but-readable information display. Usage history should be easily accessible and the "What Can I Load?" section should give actionable recommendations.

**Why this priority**: Visual polish enhances trust and daily-driver appeal, but the functional accuracy (Story 4) must come first.

**Independent Test**: Open Resource Monitor and verify smooth gauge animations, readable typography, clear section hierarchy, and no visual glitches.

**Acceptance Scenarios**:

1. **Given** the Resource Monitor page loads, **When** gauge values update, **Then** the circular gauges MUST animate smoothly between values (no snapping)
2. **Given** the Resource Monitor page, **When** viewed, **Then** all sections MUST have consistent spacing, alignment, and visual weight
3. **Given** the usage history section, **When** expanded, **Then** it MUST show a time-series visualization of CPU, RAM, and GPU usage over the recent session

---

### Edge Cases

- What happens when the user imports a corrupted or non-GGUF file with a `.gguf` extension?
  → System MUST validate the file header and display an error: "Invalid GGUF file format"
- What happens when Ollama is installed but not running?
  → System MUST detect the installation, display "Ollama found but not running", and offer a "Start Ollama" button
- What happens when the GPU monitoring process takes longer than the polling interval?
  → System MUST skip the stale reading and continue with the next poll, never blocking the UI
- What happens when a model README contains malicious HTML (script tags, event handlers)?
  → System MUST sanitize all HTML through a whitelist-based sanitizer before rendering
- What happens when the Files tab receives a file object with no filename?
  → System MUST gracefully skip or display a placeholder for files with missing metadata

---

## 3. Functional Requirements

### Bug Fixes

- **FR-001**: System MUST render model README content with full HTML support — images, links, badges, and formatted text MUST display correctly (traces to Story 1)
- **FR-002**: System MUST sanitize all README HTML content to prevent XSS attacks before rendering (traces to Story 1)
- **FR-003**: System MUST handle missing or undefined file metadata properties without crashing when displaying the Files tab (traces to Story 1)
- **FR-004**: System MUST display the Files tab file list even when individual file objects have missing or null fields (traces to Story 1)

### Layout & Navigation

- **FR-005**: System MUST show the filter sidebar ONLY on the Search/Explore page (traces to Story 2)
- **FR-006**: System MUST hide the filter sidebar on Chat, Monitor, Settings, Model Detail, Recommended, Marketplace, Community, Creator Dashboard, and Creator Profile pages (traces to Story 2)
- **FR-007**: System MUST use the full available width for main content when the filter sidebar is hidden (traces to Story 2)
- **FR-008**: System MUST preserve sidebar filter state when navigating away from and back to the Search page within the same session (traces to Story 2)

### Model Import & Discovery

- **FR-009**: System MUST provide a "Browse Models" action from the Chat empty state that navigates to the Search page (traces to Story 3)
- **FR-010**: System MUST provide a "Import GGUF File" action that opens a native file picker filtered to `.gguf` files (traces to Story 3)
- **FR-011**: System MUST detect running Ollama instances by checking the default Ollama API endpoint and listing available models (traces to Story 3)
- **FR-012**: System MUST scan the default LM Studio models directory for GGUF files and list them as importable (traces to Story 3)
- **FR-013**: System MUST allow users to load any discovered or imported model directly from the detection results (traces to Story 3)
- **FR-014**: System MUST display a helpful fallback message when no local model servers or files are detected (traces to Story 3)
- **FR-015**: System MUST persist imported model references (file path, name, size, import date) across app restarts (traces to Story 5)
- **FR-016**: System MUST detect and gracefully handle imported models whose source files have been moved or deleted (traces to Story 5)
- **FR-017**: System MUST allow removal of imported models from the list without deleting the source file (traces to Story 5)
- **FR-018**: System MUST validate that imported files are valid GGUF format before adding them to the model list (traces to Story 3)

### Resource Monitor

- **FR-019**: System MUST report real-time GPU utilization percentage for AMD GPUs (traces to Story 4)
- **FR-020**: System MUST report real-time VRAM usage (used and total) for AMD GPUs (traces to Story 4)
- **FR-021**: System MUST report GPU temperature for AMD GPUs when available (traces to Story 4)
- **FR-022**: System MUST continue to report GPU metrics for NVIDIA GPUs without regression (traces to Story 4)
- **FR-023**: System SHOULD report GPU metrics for Intel integrated graphics when available (traces to Story 4)
- **FR-024**: System MUST update all resource gauges at a consistent polling interval of no more than 3 seconds (traces to Story 4)
- **FR-025**: Resource readings MUST be within ±5% of the values reported by the operating system's native monitoring tools (traces to Story 4)

---

## 4. Non-Functional Requirements

### Performance

- **NFR-001**: Resource Monitor gauge updates MUST NOT cause visible UI jank, frame drops, or layout shifts
- **NFR-002**: Model auto-detection (Ollama + LM Studio scan) MUST complete within 5 seconds
- **NFR-003**: File picker MUST open within 500ms of user click
- **NFR-004**: README rendering MUST complete within 1 second even for large documents (>50KB)

### Security

- **NFR-005**: All user-generated or API-sourced HTML content MUST be sanitized through a whitelist-based approach before rendering to prevent XSS
- **NFR-006**: Imported model file paths MUST NOT be used to access files outside the intended directories

### Reliability

- **NFR-007**: GPU monitoring failure for one vendor MUST NOT affect monitoring of other resources (CPU, RAM)
- **NFR-008**: If GPU monitoring is unavailable, the system MUST degrade gracefully and show "Unavailable" rather than incorrect data

### Accessibility

- **NFR-009**: All action buttons in the Chat empty state MUST be keyboard-navigable and have descriptive labels
- **NFR-010**: Resource Monitor gauges MUST have screen-reader-accessible text alternatives for their values

---

## 5. Key Entities

### ImportedModel

- **What it represents**: A GGUF model file the user has imported from their local filesystem or discovered from Ollama/LM Studio
- **Key attributes**: display name, file path, file size, import date, source (manual import / Ollama / LM Studio), status (available / missing / loaded)
- **Relationships**: Can be loaded into the inference engine; persisted in local storage

### DetectedModelServer

- **What it represents**: A locally running model server instance (Ollama, LM Studio, or custom)
- **Key attributes**: server type, endpoint URL, status (running / stopped / not installed), discovered models list
- **Relationships**: Hosts zero or more models that can be loaded or connected as a compute backend

### GPUMetrics

- **What it represents**: A snapshot of GPU hardware telemetry at a point in time
- **Key attributes**: GPU name, vendor (AMD / NVIDIA / Intel), utilization percentage, VRAM used, VRAM total, temperature, timestamp
- **Relationships**: Part of the live resource data stream consumed by the Resource Monitor UI

---

## 6. Success Criteria

### Measurable Outcomes

- **SC-001**: Users can read any model's README with all formatting, images, and links rendered correctly — zero raw HTML visible
- **SC-002**: Users can click the Files tab on any model without encountering a crash or error
- **SC-003**: Users with an AMD GPU see accurate GPU utilization and VRAM readings in the Resource Monitor that match Task Manager within ±5%
- **SC-004**: Users can go from "No Model Running" on the Chat page to chatting with a model in under 60 seconds via import or auto-detect
- **SC-005**: The sidebar filter panel appears ONLY on the Search page — all other pages use full-width layout
- **SC-006**: 100% of previously passing tests (127) continue to pass after these changes
- **SC-007**: Imported models persist across app restarts with zero data loss

---

## 7. Assumptions & Dependencies

### Assumptions

- Ollama uses its default API port (11434) and default model storage directory
- LM Studio stores models in `~/.cache/lm-studio/models/` (its documented default)
- AMD GPU metrics can be read via Windows Management Instrumentation (WMI) or the ADL/ADLX SDK on Windows
- The `rehype-raw` and `rehype-sanitize` packages are already installed (confirmed in package.json)
- The current gauge component (ResourceGauge) can accept new data without structural changes

### Dependencies

- Windows WMI or equivalent system API for AMD GPU telemetry
- Ollama REST API (`GET /api/tags`) for model discovery
- Filesystem access permission for scanning LM Studio model directories
- Native file picker dialog (already available via Tauri)

---

## 8. Out of Scope

The following are explicitly **NOT** part of this feature:

- macOS or Linux GPU monitoring (Windows only for now)
- Connecting to remote Ollama/LM Studio instances (local only)
- Converting between model formats (e.g., safetensors → GGUF)
- Model download management improvements (covered in a separate spec)
- Marketplace or Community page features
- Multi-GPU setups (only the primary GPU is monitored)
- Chat UI changes beyond the empty state improvements

---

## 9. Acceptance Checklist

### Spec Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] All mandatory sections completed
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable and technology-agnostic
- [x] No `[NEEDS CLARIFICATION]` markers remain
- [x] Every user story has acceptance scenarios
- [x] Edge cases identified for major flows
- [x] Scope is clearly bounded
- [x] All functional requirements trace to a user story
