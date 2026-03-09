# HugBrowse v1.0 — Full Test Specification

## Environment

| Component | Details |
|-----------|---------|
| **OS** | Windows 11 |
| **HugBrowse** | v1.0.0 (Tauri + React, dev mode) |
| **Ollama** | Running on :11434, models: `gemma3:1b` (815MB Q4_K_M), `qwen3-embedding:8b` (4.7GB Q4_K_M) |
| **LM Studio** | Installed (not running — start if needed) |
| **API Server** | Auto-starts on :8080 |
| **MCP Server** | `hugbrowse-mcp-server` v1.0.0 (12 tools, stdio) |
| **GPU** | Check via Resource Monitor |

---

## Test Sections

### TS-01: App Launch & Onboarding

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| 01.1 | **Cold start** | Run `npm run tauri:dev` | App window opens, no crash, no panic |
| 01.2 | **API auto-start** | Check Developer tab after launch | API server shows "Running" on port 8080 |
| 01.3 | **Onboarding flow** | If first run: complete 4-step wizard | Hardware detected → Browse → Download → Chat |
| 01.4 | **Privacy consent** | Should show privacy modal if not accepted | Modal dismissible, persists choice |
| 01.5 | **System tray** | Minimize app | Tray icon appears, right-click shows menu (Open, Quick Chat, Quit) |

---

### TS-02: Model Search & Discovery

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| 02.1 | **Basic search** | Type "llama 3" in search bar, press Enter | Results load with model cards showing name, author, downloads, likes |
| 02.2 | **Filter by task** | Click "text-generation" filter | Results filtered to text-generation models only |
| 02.3 | **Sort options** | Change sort to "Most Likes" | Results reorder by like count descending |
| 02.4 | **Infinite scroll** | Scroll to bottom of results | More results load automatically |
| 02.5 | **Empty search** | Search for "xyznonexistent12345" | "No results found" message shown |
| 02.6 | **Click model card** | Click any model result | Navigates to ModelDetailPage with full info |

---

### TS-03: Model Detail Page

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| 03.1 | **Model info loads** | Navigate to a model (e.g. search "bartowski/Llama-3.2-3B-Instruct-GGUF") | Shows model name, author, tags, download count, likes |
| 03.2 | **README renders** | Scroll to README section | Model card markdown renders correctly |
| 03.3 | **Files table** | Click "Files" tab | Shows file names (NOT blank), sizes, types |
| 03.4 | **GGUF files highlighted** | Look at GGUF files in the list | GGUF files are identifiable/highlighted |
| 03.5 | **Download Now section** | Look for "Download Now" section | Prominent section with bold title, border, download buttons |
| 03.6 | **Compatibility check** | Look for hardware compatibility info | Shows if model fits in your RAM/VRAM |

---

### TS-04: Download System

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| 04.1 | **Start download** | Click download on a small GGUF file (e.g. ~800MB gemma-like model) | Download starts, progress bar appears |
| 04.2 | **Progress tracking** | Watch download progress | Shows %, speed (MB/s), ETA |
| 04.3 | **Pause download** | Click pause button | Download pauses, .part file exists on disk |
| 04.4 | **Resume download** | Click resume button | Download resumes from where it left off |
| 04.5 | **Cancel download** | Start a new download, then cancel | .part file cleaned up, status shows "Cancelled" |
| 04.6 | **Completed download** | Let a download finish | Status shows "Complete", SHA-256 validated |
| 04.7 | **Persistence** | Close and reopen app | Completed downloads still shown in history |

---

### TS-05: Model Loading (Local Sidecar)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| 05.1 | **Load from imports** | Go to Chat → select a downloaded GGUF → Load | Status: unloaded → loading → running |
| 05.2 | **GPU detection** | Check GPU layers setting before loading | Shows available GPUs (NVIDIA/AMD/Intel) |
| 05.3 | **Context size config** | Set context size to 2048 before loading | Model loads with specified context |
| 05.4 | **Check API ready** | After load completes | `/v1/models` returns the loaded model |
| 05.5 | **Unload model** | Click unload button | Status returns to "unloaded", llama-server process killed |
| 05.6 | **Memory warning** | Try to load a model that exceeds available VRAM | Warning shown with memory estimates |

---

### TS-06: Backend Management

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| 06.1 | **List backends** | Go to Settings or Chat backend selector | Shows configured backends |
| 06.2 | **Add Ollama backend** | Add custom URL backend: `http://127.0.0.1:11434/v1`, name "Ollama" | Backend added, shows in list |
| 06.3 | **Test Ollama connection** | Click "Test Connection" on Ollama backend | Shows "Online", latency_ms, discovers model name |
| 06.4 | **Set active backend** | Select Ollama as active backend | Active indicator updates |
| 06.5 | **Existing Ollama entry** | Check backends.json loaded the "Ollama: qwen3-embedding:8b" entry | Should show with `custom_url` type, URL `http://127.0.0.1:11434/v1` |
| 06.6 | **Remove backend** | Delete a test backend | Removed from list |

---

### TS-07: Chat (Core Feature — CRITICAL)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| 07.1 | **Empty state** | Open Chat with no model loaded | Shows "Get Started — Load a Model" with 3-step guide |
| 07.2 | **Chat with Ollama** | Set Ollama backend active → type "Hello, who are you?" → Send | Model responds with text, streaming visible |
| 07.3 | **Chat with local sidecar** | Load a GGUF → set local backend → send message | Response streams in real-time |
| 07.4 | **Multi-turn** | Send follow-up message in same session | Context maintained, coherent response |
| 07.5 | **New session** | Click "New Chat" | Fresh session, no prior messages |
| 07.6 | **Session list** | Check sidebar | Shows all chat sessions with titles |
| 07.7 | **System prompt** | Set system prompt to "You are a pirate" → send message | Response matches the persona |
| 07.8 | **Token speed** | Check message metadata after response | Shows tokens/sec metric |
| 07.9 | **Edit message** | Click edit on a user message → modify → resend | Conversation rewinds and regenerates |
| 07.10 | **Delete message** | Delete an assistant message | Message removed from session |
| 07.11 | **Backend attribution** | Check each message | Shows which backend generated the response |
| 07.12 | **Long response** | Ask "Write a 500 word essay about AI" | Full response streams without truncation or crash |

---

### TS-08: Resource Monitor

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| 08.1 | **Page loads** | Navigate to Resource Monitor | Shows CPU, RAM, GPU, disk metrics |
| 08.2 | **Real-time updates** | Watch for 10 seconds | Values update periodically |
| 08.3 | **Hardware tier** | Check tier classification | Shows tier (potato/laptop/gaming/workstation/server) |
| 08.4 | **Under load** | Load a model → monitor resources | RAM/VRAM usage increases visibly |

---

### TS-09: Settings & Configuration

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| 09.1 | **Theme toggle** | Switch between light/dark/system theme | Theme changes immediately |
| 09.2 | **HF token** | Enter a Hugging Face token → save | Token persisted in secure store |
| 09.3 | **Presets** | Create an inference preset (GPU layers=20, ctx=4096) | Preset saved, selectable in chat |
| 09.4 | **Export config** | Click export settings | JSON file downloaded |
| 09.5 | **Import config** | Import previously exported config | Settings restored |
| 09.6 | **MCP servers** | View configured MCP servers in settings | Shows registered servers |

---

### TS-10: Developer Page & API Server

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| 10.1 | **API status** | Open Developer tab | Shows "Running" on port 8080 (auto-started) |
| 10.2 | **Status endpoint** | `curl http://127.0.0.1:8080/api/v1/status` | Returns `{"status":"ok","version":"1.0.0",...}` |
| 10.3 | **Models endpoint** | `curl http://127.0.0.1:8080/v1/models` | Returns OpenAI-format model list |
| 10.4 | **Chat completions** | `curl -X POST http://127.0.0.1:8080/v1/chat/completions -d '{"model":"...","messages":[...]}'` | Returns chat response (requires model loaded) |
| 10.5 | **Stop/restart server** | Click Stop → Start | Server stops and restarts cleanly |
| 10.6 | **Request log** | Make a few API calls → check log | Shows request history with timestamps |
| 10.7 | **Auth tokens** | Create an API token | Token generated, shown once |
| 10.8 | **Auth enforcement** | Enable auth → call API without token | Returns 401 Unauthorized |

---

### TS-11: MCP Server (AI Agent Integration)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| 11.1 | **Server starts** | MCP server visible in VS Code Copilot Chat | Shows as connected/available |
| 11.2 | **health_check** | Call `hugbrowse_health_check` | Returns: API online, HF accessible, models count |
| 11.3 | **search_models** | Call `hugbrowse_search_models(query="phi 3")` | Returns model list with metadata |
| 11.4 | **find_gguf_models** | Call `hugbrowse_find_gguf_models(query="llama 3 8b")` | Returns GGUF repos with file sizes |
| 11.5 | **get_model_detail** | Call `hugbrowse_get_model_detail(model_id="microsoft/Phi-3-mini-4k-instruct-gguf")` | Returns full metadata |
| 11.6 | **list_model_files** | Call `hugbrowse_list_model_files(model_id="...", gguf_only=true)` | Returns only GGUF files |
| 11.7 | **get_readme** | Call `hugbrowse_get_readme(model_id="...")` | Returns model card markdown |
| 11.8 | **server_status** | Call `hugbrowse_server_status` | Returns running/port/config |
| 11.9 | **list_loaded_models** | Call `hugbrowse_list_loaded_models` | Returns loaded instances (or empty) |
| 11.10 | **load_model** | Call `hugbrowse_load_model(model_path="...", model_name="test")` | Model loads, returns success with port |
| 11.11 | **chat** | Call `hugbrowse_chat(message="What is 2+2?")` | Returns model response |
| 11.12 | **multi_turn_chat** | Call with messages array including prior context | Returns contextual response |
| 11.13 | **unload_model** | Call `hugbrowse_unload_model(instance_id="...")` | Model unloaded, resources freed |

---

### TS-12: Model Import & Scan

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| 12.1 | **Scan Ollama** | Trigger Ollama model scan | Finds `gemma3:1b` and `qwen3-embedding:8b` |
| 12.2 | **Scan LM Studio** | Trigger LM Studio scan (if models exist) | Finds any cached GGUF files |
| 12.3 | **Manual import** | Select a GGUF file from disk | File validated and added to imports |
| 12.4 | **Import persistence** | Close and reopen app | Imported models still listed |

---

### TS-13: Recommended Models Page

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| 13.1 | **Page loads** | Navigate to Recommended | Shows model suggestions based on hardware tier |
| 13.2 | **Task categories** | Check for Chat, Code, Image categories | Models organized by task type |
| 13.3 | **Hardware-appropriate** | Verify suggested models | Sizes match your hardware capabilities |

---

### TS-14: Deep Links & Navigation

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| 14.1 | **All routes work** | Navigate to each page via sidebar | All 12 pages load without errors |
| 14.2 | **Back/forward** | Use browser back/forward buttons | Navigation history works |
| 14.3 | **Keyboard shortcuts** | Test any registered shortcuts | Shortcuts trigger correct actions |
| 14.4 | **Quick Chat from tray** | Right-click tray → Quick Chat | App opens to Chat page |

---

### TS-15: Error Handling & Edge Cases

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| 15.1 | **Offline mode** | Disconnect internet → search models | Graceful error, "You're offline" indicator |
| 15.2 | **Backend down** | Stop Ollama → try to chat via Ollama backend | Clear error message, not a crash |
| 15.3 | **Invalid model path** | Try to load non-existent GGUF path | Error message with path shown |
| 15.4 | **Port conflict** | Try to start API server on occupied port | Error message about port in use |
| 15.5 | **Disk full** | Simulate low disk space during download | Warning shown before download starts |
| 15.6 | **Rapid actions** | Click load/unload rapidly | No race conditions, app stays stable |

---

### TS-16: Performance (NFR)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| 16.1 | **App startup time** | Measure cold start to window visible | < 5 seconds |
| 16.2 | **Search latency** | Measure time from search to results | < 3 seconds |
| 16.3 | **Model load time** | Measure load time for gemma3:1b (~800MB) | < 30 seconds |
| 16.4 | **First token latency** | Send message → time to first token | < 2 seconds (local), < 5 seconds (remote) |
| 16.5 | **Token throughput** | Check tokens/sec during generation | Reported accurately in UI |
| 16.6 | **Memory stability** | Run chat for 10 minutes | No memory leaks (RAM stays stable) |

---

## Quick-Run Test Script (MCP Tools)

Run these in order in Copilot Chat to test the MCP integration end-to-end:

```
1. hugbrowse_health_check()
2. hugbrowse_search_models(query="gemma", filter="gguf", limit=3)
3. hugbrowse_find_gguf_models(query="phi 3 mini", limit=2)
4. hugbrowse_get_model_detail(model_id="microsoft/Phi-3-mini-4k-instruct-gguf")
5. hugbrowse_get_readme(model_id="microsoft/Phi-3-mini-4k-instruct-gguf")
6. hugbrowse_list_model_files(model_id="microsoft/Phi-3-mini-4k-instruct-gguf", gguf_only=true)
7. hugbrowse_server_status()
8. hugbrowse_list_loaded_models()
```

If you have a downloaded GGUF file, continue:
```
9.  hugbrowse_load_model(model_path="<path-to-gguf>", model_name="Test Model")
10. hugbrowse_list_loaded_models()
11. hugbrowse_chat(message="Hello! What is 2+2?")
12. hugbrowse_multi_turn_chat(messages=[{role:"user",content:"What is the capital of France?"},{role:"assistant",content:"Paris"},{role:"user",content:"What about Germany?"}])
13. hugbrowse_unload_model(instance_id="<from step 10>")
```

---

## Test Priority Matrix

| Priority | Sections | Rationale |
|----------|----------|-----------|
| **P0 — Must Pass** | TS-01, TS-07, TS-11 | App must launch, chat must work, MCP must function |
| **P1 — Critical** | TS-02, TS-03, TS-04, TS-05, TS-06, TS-10 | Core user flows: search, download, load, backends, API |
| **P2 — Important** | TS-08, TS-09, TS-12, TS-15 | Monitor, settings, imports, error handling |
| **P3 — Nice to have** | TS-13, TS-14, TS-16 | Recommendations, navigation, performance |

---

*Total: 16 sections, 85 test cases*
*Generated: 2026-03-09*
*Target: HugBrowse v1.0.0*
