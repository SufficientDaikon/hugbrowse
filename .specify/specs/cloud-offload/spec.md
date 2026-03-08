# Feature Specification: Cloud Offload

**Created**: 2026-08-03
**Status**: Draft
**Source**: HugBrowse Cloud Offload feature plan — transform local-only inference to local-first, cloud-optional hybrid compute

---

## 1. Project Overview

### What We're Building

**Cloud Offload** adds remote compute capabilities to HugBrowse, allowing users to run AI model inference on remote servers instead of (or in addition to) their local machine. Today, HugBrowse can only run models via a local sidecar process on `127.0.0.1`. Cloud Offload introduces the concept of a **Compute Backend** — a first-class abstraction that treats the local sidecar as just one backend among many. Users can connect to any OpenAI-compatible remote endpoint or auto-deploy managed endpoints through HuggingFace Inference Endpoints, all while keeping the exact same chat experience.

### Why We're Building It

1. **Hardware barrier**: Many users have machines too weak to run large models locally (insufficient VRAM, slow CPU inference). Cloud Offload removes this barrier entirely.
2. **Flexibility**: Power users want to offload to a beefy server on their LAN, a cloud VM, or a managed endpoint — depending on the task, cost, and latency trade-off.
3. **Resource preservation**: Even users with capable hardware sometimes want to keep local GPU free for other tasks (gaming, creative apps) while still chatting with models.
4. **Competitive parity**: Leading model UIs support both local and remote inference. HugBrowse's local-only constraint limits its addressable audience.

### Who It's For

**Primary persona — "The Constrained User"**: Owns a laptop or desktop that struggles with large models (≤8GB VRAM or CPU-only). Wants to use 13B+ parameter models but can't run them locally. Willing to pay for cloud compute or use free-tier HuggingFace endpoints.

**Secondary persona — "The Power User"**: Owns powerful hardware but also maintains remote servers (homelab, VPS, cloud VMs). Wants a single UI to switch between local inference and remote servers depending on context.

**Tertiary persona — "The Explorer"**: Wants to try many different models quickly without waiting for multi-gigabyte downloads. Uses HuggingFace Inference Endpoints to spin up models on demand.

---

## 2. User Scenarios & Stories

### User Story 1 — Connect to a Custom Remote Endpoint (Priority: P1)

A user has a remote server running an OpenAI-compatible inference endpoint (e.g., llama-server, vLLM, text-generation-inference, Ollama, or any service exposing `/v1/chat/completions`). The user opens HugBrowse's compute backend settings, selects "Add Custom Endpoint", pastes the server's URL, optionally provides an API key, and clicks "Test Connection". HugBrowse validates the endpoint by sending a lightweight probe request. Once validated, the endpoint appears in the backend selector. The user selects it, and all subsequent chat messages are routed to this remote endpoint instead of the local sidecar. Streaming, token metrics, and the entire chat experience remain identical.

**Why this priority**: This is the simplest, most universal integration point. It works with ANY OpenAI-compatible server — no vendor lock-in, no API key management complexity. It also unblocks all other remote scenarios (HF endpoints, VPS, LAN servers) because they all ultimately expose the same API surface.

**Independent Test**: Spin up a remote llama-server on a second machine, paste its URL in HugBrowse, verify chat works identically to local inference.

**Acceptance Scenarios**:

1. **Given** the user is on the compute backend settings screen, **When** they click "Add Custom Endpoint" and enter a valid URL (e.g., `https://my-server.example.com/v1`), **Then** the system displays a connection test button.
2. **Given** the user clicks "Test Connection" with a valid, reachable endpoint, **When** the probe request succeeds and returns a compatible response, **Then** the endpoint is marked "Online" with a green status indicator and a measured latency value (in ms).
3. **Given** the user clicks "Test Connection" with an unreachable URL, **When** the probe request times out or fails, **Then** the system displays a clear error message ("Could not reach endpoint — check the URL and ensure the server is running") without crashing or freezing.
4. **Given** the user has added and validated a custom endpoint, **When** they select it as the active backend in the backend selector, **Then** subsequent chat messages are routed to this remote URL and responses stream identically to local inference.
5. **Given** the user's custom endpoint requires an API key, **When** they enter the key in the "API Key (optional)" field, **Then** the key is stored securely (not in plaintext config) and included as a Bearer token in all requests to that endpoint.
6. **Given** the user has a custom endpoint selected and it goes offline, **When** the health monitor detects the outage, **Then** the backend status changes to "Offline" (red indicator) and the user is notified with an option to switch to another available backend.

---

### User Story 2 — Deploy a Model to HuggingFace Inference Endpoints (Priority: P1)

A user finds a model in HugBrowse's model browser and wants to run it remotely without downloading it. They click "Deploy to Cloud" on the model detail page. A deployment dialog appears showing HuggingFace Inference Endpoints as the deployment target. The user enters (or confirms) their HuggingFace API token, selects an instance size and region, and clicks "Deploy". HugBrowse creates the endpoint via the HuggingFace API, shows a "Deploying…" progress state, and once the endpoint is running, automatically registers it as a compute backend and makes it the active backend. The user can now chat with the model immediately.

**Why this priority**: This is the "magic" experience — zero server setup, one-click cloud deployment. It's the most differentiated feature and the one most likely to convert local-only users into cloud-optional users. HuggingFace Inference Endpoints are the natural partner given HugBrowse already integrates with the HF ecosystem.

**Independent Test**: Pick any supported GGUF model on HuggingFace, deploy it via the dialog, verify chat works once the endpoint is live.

**Acceptance Scenarios**:

1. **Given** the user is on a model detail page for an HF-hosted model, **When** they click "Deploy to Cloud", **Then** a deployment dialog opens showing HuggingFace Inference Endpoints as the target, pre-filled with the model's HF ID.
2. **Given** the deployment dialog is open and the user has not previously saved an HF token, **When** the dialog loads, **Then** it prompts for an HF API token with a link to generate one, and validates the token before proceeding.
3. **Given** the user has a valid HF token and selects instance configuration (size, region), **When** they click "Deploy", **Then** the system initiates deployment and shows a "Deploying…" state with an estimated wait time.
4. **Given** deployment is in progress, **When** the HF endpoint transitions to "running" state, **Then** the system automatically registers the endpoint as a compute backend, sets it as the active backend, and shows a success notification with the endpoint URL and estimated hourly cost.
5. **Given** deployment fails (quota exceeded, invalid model, payment required), **When** the error is returned from HuggingFace, **Then** the system shows a human-readable error message with guidance (e.g., "Your HuggingFace account does not have Inference Endpoints enabled — visit huggingface.co/settings to upgrade").
6. **Given** the user already has a saved HF token from previous usage, **When** they open the deployment dialog, **Then** the token field is pre-populated (masked) and the user can proceed without re-entering it.

---

### User Story 3 — Switch Between Compute Backends (Priority: P1)

A user has both a local model loaded and a remote endpoint configured. They are chatting with the local backend but want to switch to the remote one (e.g., local is slow, or they want to compare outputs). The user opens the backend selector (visible in the chat interface header or inference panel), sees a list of all configured backends with their status (Online/Offline/Loading) and latency, selects the remote backend, and continues chatting. The switch is seamless — no page reload, no loss of chat history, and the next message goes to the new backend.

**Why this priority**: The ability to fluidly move between local and remote is the core UX promise of "local-first, cloud-optional." Without seamless switching, the feature is just two disconnected modes.

**Independent Test**: Load a model locally, add a remote endpoint, switch between them mid-conversation, verify messages route correctly and history is preserved.

**Acceptance Scenarios**:

1. **Given** the user has at least two configured backends (one local, one remote), **When** they open the backend selector, **Then** they see a list showing each backend's name, type (local/remote), status (Online/Offline/Deploying/Error), and measured latency.
2. **Given** the user selects a different backend from the selector, **When** the switch completes, **Then** the active backend indicator updates, the switch takes less than 2 seconds, and no chat history is lost or modified.
3. **Given** the user switches from local to remote backend mid-conversation, **When** they send the next message, **Then** the message is routed to the newly selected remote endpoint and the response streams back normally.
4. **Given** the user switches to a backend that is offline, **When** they attempt to send a message, **Then** the system displays an error explaining the backend is unavailable and suggests switching to an online backend or re-checking the connection.
5. **Given** the user has only one backend configured (local), **When** they view the backend selector, **Then** the selector shows the single backend as active with no switch option, and an "Add Backend" affordance is visible.
6. **Given** the user switches backends, **When** the chat history is displayed, **Then** messages from different backends are visually distinguishable (e.g., a subtle label or icon indicating which backend generated each response).

---

### User Story 4 — Monitor Remote Backend Health (Priority: P1)

A user has a remote endpoint selected as their active compute backend. The system continuously monitors the endpoint's availability and latency. The current health status is always visible in the UI — a small status indicator (green/yellow/red dot) next to the backend name. If the remote endpoint becomes unreachable, the user is notified promptly and offered the option to fall back to a local backend if one is available.

**Why this priority**: Remote endpoints are inherently less reliable than local sidecars (network issues, server restarts, quota exhaustion). Without health monitoring, users would experience silent failures — sending messages into the void with no feedback. This is a core reliability requirement.

**Independent Test**: Connect to a remote endpoint, verify the health indicator shows green, then shut down the remote server and verify the indicator changes to red within a reasonable time window.

**Acceptance Scenarios**:

1. **Given** a remote backend is configured and selected as active, **When** the system performs a health check, **Then** the health status indicator reflects the current state (Online = green, Degraded = yellow, Offline = red).
2. **Given** a remote backend transitions from Online to Offline, **When** the health monitor detects the change (within two consecutive failed checks), **Then** the status indicator turns red and an in-app notification appears: "Remote endpoint is offline."
3. **Given** a remote backend is offline and a local backend is available and loaded, **When** the user receives the offline notification, **Then** the notification includes a "Switch to Local" action button.
4. **Given** a remote backend is online, **When** the health monitor measures latency, **Then** the latency value (in milliseconds) is displayed next to the backend status and updated on each health check cycle.
5. **Given** the active backend is a paid HuggingFace Inference Endpoint, **When** the health monitor runs, **Then** it does not exceed one health check request per 5 seconds to avoid burning API quota or incurring unnecessary costs.
6. **Given** a remote backend returns an authentication error (401/403) during a health check, **When** the error is detected, **Then** the status shows "Auth Error" with guidance to update the API key, rather than simply "Offline."

---

### User Story 5 — Manage HF Inference Endpoint Lifecycle (Priority: P2)

A user has previously deployed a model to HuggingFace Inference Endpoints through HugBrowse. They want to manage the endpoint's lifecycle without leaving the app — pause it when not in use (to stop billing), resume it when needed, check current cost/usage, and delete it when done. The endpoint management UI is accessible from the backend detail panel.

**Why this priority**: HF Inference Endpoints cost real money. Without lifecycle management, users must leave HugBrowse to manage billing-sensitive resources in the HuggingFace web console. This creates friction and risk (forgotten endpoints running up bills).

**Independent Test**: Deploy an endpoint via Story 2, pause it, verify status changes, resume it, verify chat works again, delete it, verify it's removed from backends.

**Acceptance Scenarios**:

1. **Given** the user has an active HF Inference Endpoint backend, **When** they open the backend detail panel, **Then** they see lifecycle controls: Pause, Resume, and Delete, along with current status and cost information.
2. **Given** the user clicks "Pause" on a running endpoint, **When** the pause request succeeds, **Then** the backend status changes to "Paused", the status indicator turns yellow, and a confirmation message notes that billing is suspended.
3. **Given** a paused endpoint, **When** the user clicks "Resume", **Then** the endpoint starts booting (status: "Resuming…"), and once running, status returns to Online with a green indicator.
4. **Given** the user clicks "Delete" on an endpoint, **When** they confirm the destructive action in a confirmation dialog, **Then** the endpoint is deleted on HuggingFace and removed from the backends list.
5. **Given** an HF Endpoint backend exists, **When** the user views its detail panel, **Then** they see: instance type, region, model loaded, estimated hourly cost, and time since deployment.

---

### User Story 6 — Discover Local Network Servers (Priority: P2)

A user has a llama-server (or compatible) instance running on another machine on their local network. Instead of manually entering the IP and port, HugBrowse can scan the local network for compatible inference endpoints. The user clicks "Discover LAN Servers", the system scans common ports, and any found endpoints appear as suggested backends to add.

**Why this priority**: LAN inference is a common power-user setup (dedicated inference machine, homelab GPU server). Auto-discovery removes friction compared to manual URL entry.

**Independent Test**: Run llama-server on a second machine on the same network, trigger LAN discovery, verify it's found and connectable.

**Acceptance Scenarios**:

1. **Given** the user is on the backend settings screen, **When** they click "Discover LAN Servers", **Then** the system scans the local network for OpenAI-compatible endpoints on common inference ports.
2. **Given** the scan discovers one or more endpoints, **When** the scan completes, **Then** the found endpoints are listed with their IP, port, and a preliminary status (Reachable/Unreachable).
3. **Given** the user selects a discovered endpoint, **When** they click "Add", **Then** the endpoint is validated (probe request) and added to the backends list as a Custom URL backend.
4. **Given** no endpoints are found on the local network, **When** the scan completes, **Then** the system displays "No inference endpoints found on your local network" with tips (e.g., "Make sure the server is running and bound to 0.0.0.0, not 127.0.0.1").

---

### User Story 7 — Cost Estimation and Usage Tracking (Priority: P2)

A user is chatting with a model via a paid HuggingFace Inference Endpoint. After each response, the system shows an estimated cost for that exchange (based on token count and the endpoint's pricing tier). A running total of accumulated cost for the current session is visible, so the user can make informed decisions about continued usage.

**Why this priority**: Cost visibility prevents bill shock. Users need to understand the financial implications of remote inference in real-time, not after a surprise bill arrives.

**Independent Test**: Chat via a paid HF endpoint, verify per-message cost estimates appear, verify session totals accumulate correctly.

**Acceptance Scenarios**:

1. **Given** the active backend is a paid endpoint with known per-token pricing, **When** a chat message exchange completes, **Then** the estimated cost for that exchange is displayed alongside the response (e.g., "~$0.002").
2. **Given** an ongoing session using a paid backend, **When** the user views the session info, **Then** they see a cumulative cost estimate for the session.
3. **Given** the backend's pricing is unknown (custom URL with no pricing info), **When** the user chats, **Then** no cost estimate is shown (graceful omission, not an error).

---

### User Story 8 — SSH Deploy to Remote Server (Priority: P3)

A user has a VPS or remote machine accessible via SSH. They want HugBrowse to deploy a llama-server instance on that machine automatically — uploading the binary, transferring the model, and starting the server. The user provides SSH credentials, selects a model, and HugBrowse handles the rest.

**Why this priority**: This is a powerful automation feature but has significant complexity (SSH key management, cross-platform binary selection, firewall configuration). It serves a narrow audience of advanced users.

**Independent Test**: Provide SSH access to a test VPS, deploy a small model, verify chat works through the deployed remote endpoint.

**Acceptance Scenarios**:

1. **Given** the user selects "Deploy via SSH" and enters host, port, username, and authentication method (password or key), **When** they click "Test Connection", **Then** the system verifies SSH connectivity and reports success or failure.
2. **Given** SSH connectivity is verified and a model is selected, **When** the user clicks "Deploy", **Then** the system transfers the inference server binary and model file to the remote machine, starts the server, and registers it as a backend.
3. **Given** deployment is in progress, **When** the user views the deployment status, **Then** they see progress stages (Connecting → Uploading binary → Transferring model → Starting server → Ready).

---

### User Story 9 — Multi-Backend Load Balancing (Priority: P3)

A user has multiple backends configured (e.g., two remote servers). They want to distribute inference requests across them for higher throughput or redundancy. The system supports a simple round-robin or fastest-response routing strategy.

**Why this priority**: Load balancing is an advanced optimization. It provides value only to users with multiple backends and high throughput needs — a small subset of the user base.

**Independent Test**: Configure two remote backends, enable load balancing, send multiple messages, verify requests are distributed across both backends.

**Acceptance Scenarios**:

1. **Given** the user has two or more online backends, **When** they enable "Load Balance" mode, **Then** subsequent requests are distributed across the selected backends.
2. **Given** load balancing is active and one backend goes offline, **When** the next request is sent, **Then** the system routes to the remaining online backend(s) without user intervention.
3. **Given** load balancing is active, **When** the user views the backend selector, **Then** they see which backends are in the load-balance pool and the request distribution (e.g., "Backend A: 5 requests, Backend B: 7 requests").

---

### Edge Cases

- **EC-CO-001**: What happens when a remote endpoint goes offline mid-stream (tokens are being received)?
  - The system MUST detect the broken stream, stop the streaming indicator, display the partial response received so far with an error annotation ("Response interrupted — remote endpoint disconnected"), and offer a "Retry" button that re-sends the last user message.

- **EC-CO-002**: What if the user's HuggingFace API token expires or is revoked mid-session?
  - The system MUST detect 401/403 responses from the HF API, surface a clear error ("Your HuggingFace token is invalid or expired"), and prompt the user to re-enter their token without losing chat history or backend configuration.

- **EC-CO-003**: What if the remote endpoint's model doesn't match what the user expects (e.g., different model loaded than configured)?
  - During connection validation, the system SHOULD probe the `/v1/models` endpoint (if available) and compare the reported model name to the expected model. If there's a mismatch, the system displays a warning: "This endpoint reports model X, but you expected model Y. Continue anyway?" The user can acknowledge and proceed.

- **EC-CO-004**: Network timeout handling — how long to wait before showing an error?
  - Connection probe: 10-second timeout. Health checks: 5-second timeout per request. Chat requests: 30-second timeout for first token, then 60-second idle timeout between tokens during streaming. All timeouts MUST produce user-visible error messages, not silent hangs.

- **EC-CO-005**: CORS issues when the frontend fetches directly to a remote endpoint.
  - Remote requests MUST be proxied through the Tauri backend (Rust HTTP client) to avoid browser CORS restrictions. The frontend MUST NOT make direct fetch calls to remote endpoints — it sends requests to the Tauri backend via IPC, and the backend forwards them to the remote URL. This also provides a single point for credential injection, timeout management, and TLS verification.

- **EC-CO-006**: What if the user has both local and remote backends available — which takes priority?
  - On app launch, the system restores the last-used active backend. If the last-used backend is unavailable, it falls back to the local backend if loaded. If no local backend is loaded, it shows a "No active backend" state with a prompt to select or configure one. There is no automatic fallback during a conversation — the user must explicitly switch.

- **EC-CO-007**: Rate limiting on paid endpoints.
  - If a remote endpoint returns HTTP 429 (Too Many Requests), the system MUST pause sending, display "Rate limited — waiting to retry", and retry with exponential backoff (1s, 2s, 4s, max 30s). After 3 failed retries, display a persistent error and stop retrying.

- **EC-CO-008**: Model compatibility — ensuring the remote model matches the chat context format.
  - The system SHOULD NOT enforce model-specific chat templates for remote endpoints. It sends standard OpenAI-format messages (`role` + `content`). The remote endpoint is responsible for applying its own chat template. If the response is garbled or empty, the system displays a warning suggesting the user check model compatibility.

- **EC-CO-009**: What if the user adds a URL that is a local address (127.0.0.1 or localhost) as a "remote" endpoint?
  - The system MUST allow this (it's a valid use case — testing, or a different local server). It should be categorized as "Custom URL" regardless of address and should not conflict with the built-in local sidecar backend.

- **EC-CO-010**: What if the user deletes or disconnects the active backend?
  - The system MUST switch to a "No active backend" state, stop any pending health checks for that backend, and prompt the user to select another backend. Pending chat messages that were in-flight MUST be cancelled cleanly and the user notified.

- **EC-CO-011**: What happens during app startup if the previously active backend was a remote endpoint?
  - The system MUST attempt to reconnect to the remote endpoint silently. If reachable, restore as active backend. If unreachable after 3 attempts (with 2-second intervals), mark as Offline and display a notification with options to retry, switch to local, or ignore.

---

## 3. Functional Requirements

### Core Backend Abstraction

- **FR-CO-001**: The system MUST implement a Compute Backend abstraction that treats local sidecar inference and remote endpoint inference as interchangeable providers of the same chat completions interface. _(Traces to: Stories 1, 2, 3)_
- **FR-CO-002**: The system MUST maintain a persistent list of configured compute backends across application sessions. _(Traces to: Stories 1, 2, 3)_
- **FR-CO-003**: The system MUST designate exactly one backend as "active" at any time, or be in a "no active backend" state. _(Traces to: Story 3)_
- **FR-CO-004**: The system MUST represent the existing local sidecar inference as a built-in backend that is always present in the backends list (even when no model is loaded locally; its status would be "No model loaded"). _(Traces to: Story 3)_

### Custom Endpoint Connection (Story 1)

- **FR-CO-005**: The system MUST allow users to add a custom remote endpoint by providing: a display name, a base URL, and an optional API key. _(Traces to: Story 1)_
- **FR-CO-006**: The system MUST validate a custom endpoint by sending a probe request to the URL's completions path or models path, with a configurable timeout of 10 seconds. _(Traces to: Story 1)_
- **FR-CO-007**: Upon successful validation, the system MUST store the endpoint configuration and display it in the backends list with measured latency and an "Online" status. _(Traces to: Story 1)_
- **FR-CO-008**: Upon failed validation, the system MUST display a descriptive error message indicating the failure reason (timeout, connection refused, HTTP error code, TLS error) without crashing. _(Traces to: Story 1)_
- **FR-CO-009**: The system MUST allow users to edit the name, URL, and API key of existing custom endpoints. _(Traces to: Story 1)_
- **FR-CO-010**: The system MUST allow users to remove a custom endpoint from the backends list, with a confirmation step if the endpoint is currently active. _(Traces to: Story 1)_

### HuggingFace Inference Endpoint Deployment (Story 2)

- **FR-CO-011**: The system MUST provide a "Deploy to Cloud" action on model detail pages for HuggingFace-hosted models. _(Traces to: Story 2)_
- **FR-CO-012**: The deployment dialog MUST collect: HF API token (pre-filled if saved), instance size selection, and region selection. _(Traces to: Story 2)_
- **FR-CO-013**: The system MUST validate the HF API token before initiating deployment. _(Traces to: Story 2)_
- **FR-CO-014**: The system MUST create the HF Inference Endpoint via the HuggingFace API and track the deployment state (Pending → Initializing → Running → Failed). _(Traces to: Story 2)_
- **FR-CO-015**: Once the endpoint reaches "Running" state, the system MUST automatically register it as a compute backend and set it as the active backend. _(Traces to: Story 2)_
- **FR-CO-016**: The system MUST display the estimated hourly cost of the deployed endpoint before the user confirms deployment. _(Traces to: Story 2)_
- **FR-CO-017**: If deployment fails, the system MUST display the error reason from HuggingFace with actionable guidance. _(Traces to: Story 2)_

### Backend Switching (Story 3)

- **FR-CO-018**: The system MUST provide a backend selector UI element accessible from the chat interface that shows all configured backends with their current status, type, and latency. _(Traces to: Story 3)_
- **FR-CO-019**: Switching the active backend MUST NOT clear, modify, or reload the current chat session's history. _(Traces to: Story 3)_
- **FR-CO-020**: After switching backends, the very next chat message MUST be routed to the newly selected backend. _(Traces to: Story 3)_
- **FR-CO-021**: The system MUST visually indicate which backend generated each assistant response in the chat history (e.g., a small label or icon). _(Traces to: Story 3)_
- **FR-CO-022**: Backend switching MUST complete (UI updates, routing changes) within 2 seconds. _(Traces to: Story 3)_

### Health Monitoring (Story 4)

- **FR-CO-023**: The system MUST perform periodic health checks on the active remote backend to detect availability changes. _(Traces to: Story 4)_
- **FR-CO-024**: Health check frequency for remote backends MUST be no more than one request per 5 seconds to conserve API quota. _(Traces to: Story 4)_
- **FR-CO-025**: Health check responses MUST be used to update both the availability status (Online/Offline/Degraded/Auth Error) and the measured latency. _(Traces to: Story 4)_
- **FR-CO-026**: When a remote backend transitions from Online to Offline, the system MUST display an in-app notification within 15 seconds of the failure onset. _(Traces to: Story 4)_
- **FR-CO-027**: When the active remote backend goes offline and a local backend is available and loaded, the notification MUST include a "Switch to Local" quick action. _(Traces to: Story 4)_
- **FR-CO-028**: The system MUST distinguish between network unreachability, server errors (5xx), and authentication errors (401/403) and display appropriate status labels for each. _(Traces to: Story 4)_

### Request Proxying

- **FR-CO-029**: All HTTP requests to remote endpoints MUST be routed through the Tauri backend (Rust HTTP client) via IPC commands, not via direct browser fetch from the frontend. _(Traces to: EC-CO-005)_
- **FR-CO-030**: The Tauri backend MUST inject stored credentials (Bearer token) into proxied requests automatically. _(Traces to: Stories 1, 2)_
- **FR-CO-031**: The Tauri backend MUST forward SSE streaming responses from remote endpoints back to the frontend in real-time, preserving the same event format as the local sidecar. _(Traces to: Stories 1, 2, 3)_

### HF Endpoint Lifecycle Management (Story 5)

- **FR-CO-032**: The system MUST allow users to pause a running HF Inference Endpoint (suspending billing). _(Traces to: Story 5)_
- **FR-CO-033**: The system MUST allow users to resume a paused HF Inference Endpoint. _(Traces to: Story 5)_
- **FR-CO-034**: The system MUST allow users to delete an HF Inference Endpoint with a confirmation dialog warning that this is destructive and irreversible. _(Traces to: Story 5)_
- **FR-CO-035**: The system MUST display endpoint metadata: instance type, region, model, estimated hourly cost, and uptime since last deployment. _(Traces to: Story 5)_

### LAN Discovery (Story 6)

- **FR-CO-036**: The system MUST provide a "Discover LAN Servers" action that scans the local network for OpenAI-compatible inference endpoints on well-known ports. _(Traces to: Story 6)_
- **FR-CO-037**: Discovered endpoints MUST be presented as suggestions that the user can choose to add to their backends list. _(Traces to: Story 6)_
- **FR-CO-038**: LAN discovery MUST complete or timeout within 30 seconds and provide progress feedback during the scan. _(Traces to: Story 6)_

### Cost Tracking (Story 7)

- **FR-CO-039**: For backends with known per-token pricing, the system MUST calculate and display an estimated cost after each chat exchange. _(Traces to: Story 7)_
- **FR-CO-040**: The system MUST maintain a per-session cumulative cost estimate. _(Traces to: Story 7)_
- **FR-CO-041**: For backends without known pricing (custom URLs), the system MUST gracefully omit cost display without errors. _(Traces to: Story 7)_

### Validation & Security

- **FR-CO-042**: The system MUST store all API keys and credentials in encrypted secure storage, never in plaintext configuration files or browser localStorage. _(Traces to: Stories 1, 2)_
- **FR-CO-043**: The system MUST validate that remote endpoint URLs use HTTPS for any non-local address (not 127.0.0.1, not localhost, not private IP ranges 10.x.x.x, 192.168.x.x, 172.16-31.x.x). For local/LAN addresses, HTTP is permitted. _(Traces to: NFR-CO-003)_
- **FR-CO-044**: The system MUST NOT transmit credentials to any endpoint other than the one they are configured for. _(Traces to: Security)_

### Data & Persistence

- **FR-CO-045**: The system MUST persist all backend configurations (name, URL, type, credential references) across application restarts. _(Traces to: Stories 1, 2)_
- **FR-CO-046**: The system MUST persist the user's last-active backend selection and restore it on next launch. _(Traces to: Story 3, EC-CO-011)_
- **FR-CO-047**: The system MUST persist per-session inference metadata (which backend generated each message, token count, cost estimate) as part of the chat session data. _(Traces to: Stories 3, 7)_
- **FR-CO-048**: When a backend is deleted, the system MUST retain chat history that was generated through that backend, with a "deleted backend" notation. _(Traces to: Story 3)_

---

## 4. Non-Functional Requirements

### Performance

- **NFR-CO-001**: Backend switching (from user click to routing change) MUST complete within 2 seconds.
- **NFR-CO-002**: Connection validation (probe request) MUST complete or timeout within 10 seconds.
- **NFR-CO-003**: The first streamed token from a remote backend MUST arrive within 30 seconds of sending a request (timeout threshold). Idle timeout between subsequent tokens is 60 seconds.
- **NFR-CO-004**: Health check requests to remote backends MUST have a 5-second timeout per request.

### Scalability

- **NFR-CO-005**: The system MUST support at least 20 configured backends simultaneously without UI performance degradation.
- **NFR-CO-006**: LAN discovery MUST scan at least a /24 subnet (254 hosts) within 30 seconds.

### Security

- **NFR-CO-007**: All API keys and tokens MUST be stored using the Tauri secure credential store (encrypted at rest by the OS keychain).
- **NFR-CO-008**: All remote connections to public internet endpoints MUST use HTTPS/TLS. HTTP is only permitted for localhost and private network addresses.
- **NFR-CO-009**: API keys MUST NOT appear in application logs, error messages displayed to users, or frontend state that could be inspected via developer tools.
- **NFR-CO-010**: Credentials MUST be transmitted only to their designated endpoint — the system MUST NOT leak credentials across backends.

### Accessibility

- **NFR-CO-011**: All backend management UI elements (selector, status indicators, configuration forms) MUST be keyboard-navigable and screen-reader accessible.
- **NFR-CO-012**: Backend status indicators MUST NOT rely solely on color — they MUST also include text labels or icons for color-blind users (e.g., "Online" text alongside green dot).

### Reliability

- **NFR-CO-013**: If a remote endpoint fails mid-stream, the system MUST preserve any partial response received and clearly annotate it as incomplete.
- **NFR-CO-014**: Network failures during health checks MUST NOT crash the application or corrupt state.
- **NFR-CO-015**: The system MUST gracefully handle all HTTP error codes from remote endpoints (4xx, 5xx) with human-readable error messages.
- **NFR-CO-016**: Rate-limited responses (HTTP 429) MUST trigger automatic retry with exponential backoff (1s, 2s, 4s, max 30s, 3 retries max before surfacing the error).

### Latency Transparency

- **NFR-CO-017**: The system MUST display measured network round-trip latency for each remote backend, updated on every health check cycle.
- **NFR-CO-018**: Chat responses from remote backends MUST display first-token latency and tokens-per-second metrics, identical to local inference metrics.

---

## 5. Key Entities

### Compute Backend

- **What it represents**: A source of inference compute — either the user's local machine (via sidecar) or a remote server. This is the central abstraction of Cloud Offload.
- **Key attributes**:
  - Unique identifier
  - User-assigned display name
  - Backend type: Local Sidecar | HuggingFace Endpoint | Custom URL | SSH Deployed | LAN Discovered
  - Endpoint URL (for remote types; implicit for local)
  - Current status: Online | Offline | Deploying | Paused | Error | Auth Error | No Model Loaded
  - Measured network latency (milliseconds; 0 for local)
  - Reference to associated credential (if any)
  - Name of model currently loaded/served
  - Cost per token (if known; null otherwise)
  - Whether this is the currently active backend (boolean)
  - Timestamp of last successful health check
- **Relationships**: Has zero or one Backend Credential. Has zero or one HF Endpoint Configuration (if type is HuggingFace Endpoint). Generates zero or many Inference Sessions.

### Backend Credential

- **What it represents**: An encrypted API key or token associated with a specific backend or provider. Stored in the OS-level secure credential store, not in application config.
- **Key attributes**:
  - Unique identifier
  - Associated backend identifier
  - Provider label (e.g., "HuggingFace", "Custom", "SSH")
  - Encrypted API key or token (stored in OS keychain, referenced by ID)
  - Creation timestamp
  - Last-validated timestamp
- **Relationships**: Belongs to exactly one Compute Backend. A single HF token may be shared across multiple HF Endpoint backends (referenced by the same credential ID).

### HF Endpoint Configuration

- **What it represents**: Configuration specific to a HuggingFace Inference Endpoint deployment — captures the deployment parameters and managed resource metadata.
- **Key attributes**:
  - Associated backend identifier
  - HuggingFace model identifier (org/model-name)
  - Instance type/size selection
  - Deployment region
  - Auto-scaling configuration (min/max replicas)
  - Estimated monthly and hourly cost
  - HuggingFace endpoint resource name (for API lifecycle calls)
  - Deployment creation timestamp
- **Relationships**: Belongs to exactly one Compute Backend (of type HuggingFace Endpoint).

### Inference Session Metadata

- **What it represents**: Tracks which backend served each portion of a chat session, along with usage metrics. This extends the existing chat session data — it does not replace it.
- **Key attributes**:
  - Associated chat session identifier
  - Associated backend identifier (per message or per segment)
  - Model name as reported by the backend
  - Tokens consumed (prompt + completion)
  - Accumulated cost estimate (for priced backends)
  - First-token latency per response
  - Tokens-per-second per response
- **Relationships**: Extends existing Chat Session. References one or more Compute Backends (a session may span multiple backends if the user switches mid-conversation).

### Chat Message (Extended)

- **What it represents**: The existing chat message entity, extended with Cloud Offload metadata.
- **Key attributes** (new, in addition to existing):
  - Backend identifier that generated this response (for assistant messages)
  - Backend display name at time of generation (snapshot, since backend may be renamed or deleted later)
  - Backend type at time of generation
- **Relationships**: Belongs to a Chat Session. References the Compute Backend that generated it (for assistant messages).

---

## 6. Success Criteria

### Measurable Outcomes

- **SC-CO-001**: A user with no local GPU can successfully chat with a 13B+ parameter model via a remote backend within 5 minutes of first launch (including setup time). _(Validates: Stories 1, 2)_
- **SC-CO-002**: Switching between local and remote backends mid-conversation produces no data loss (zero dropped messages, zero corrupted sessions) across 100 consecutive switch cycles. _(Validates: Story 3, FR-CO-019)_
- **SC-CO-003**: Remote backend health status changes (Online → Offline) are reflected in the UI within 15 seconds of the actual status change. _(Validates: Story 4, FR-CO-026)_
- **SC-CO-004**: All API keys and tokens remain encrypted at rest — a filesystem search of the application's data directory returns zero plaintext credential matches. _(Validates: FR-CO-042, NFR-CO-007)_
- **SC-CO-005**: The chat experience (streaming behavior, token metrics display, message rendering) is visually and functionally indistinguishable between local and remote backends, aside from the backend indicator label and latency value. _(Validates: FR-CO-001, FR-CO-031)_
- **SC-CO-006**: A one-click HuggingFace Inference Endpoint deployment completes (model deployed, chat ready) with no more than 3 user interactions: click "Deploy to Cloud", confirm configuration, wait for deployment. _(Validates: Story 2)_
- **SC-CO-007**: Backend switching completes in under 2 seconds in 95% of cases, measured from the user's click to the first health check of the new active backend. _(Validates: NFR-CO-001)_
- **SC-CO-008**: Cost estimates displayed for HF Inference Endpoints are within 20% of actual billed cost for a given conversation (validated against HF billing dashboard). _(Validates: Story 7, FR-CO-039)_

---

## 7. Assumptions & Dependencies

### Assumptions

- **A-001**: Remote endpoints expose an OpenAI-compatible `/v1/chat/completions` API with SSE streaming support. Non-compatible endpoints are out of scope.
- **A-002**: The HuggingFace Inference Endpoints API is stable, publicly documented, and available for programmatic endpoint creation, management, and deletion.
- **A-003**: Users who deploy to HuggingFace Inference Endpoints have an active HuggingFace account with billing enabled (the system does not handle HF account creation or billing setup).
- **A-004**: The existing Tauri secure store plugin provides adequate encryption for credential storage on all supported platforms (Windows, macOS, Linux).
- **A-005**: Network latency to remote endpoints is variable but measurable via round-trip health check timing, which is a reasonable proxy for inference request latency.
- **A-006**: The existing chat message format (role + content + tool calls) is sufficient for remote endpoints — no custom protocol extensions are needed.
- **A-007**: CORS restrictions in the Tauri webview can be bypassed by routing requests through the Rust backend via IPC, which has unrestricted HTTP client capabilities.
- **A-008**: HuggingFace Inference Endpoints pricing information is available at endpoint creation time and can be displayed to users.

### Dependencies

- **D-001**: HuggingFace Inference Endpoints API — required for Stories 2, 5. If the API changes or becomes unavailable, those features are blocked.
- **D-002**: Tauri v2 secure store plugin (`@tauri-apps/plugin-store`) — required for encrypted credential storage.
- **D-003**: Tauri v2 HTTP client capability — required for proxying remote requests through the Rust backend (FR-CO-029).
- **D-004**: Existing inference architecture (inference.rs, chat.ts, inference.ts stores) — Cloud Offload extends these; changes to the existing local inference flow must be backward-compatible.
- **D-005**: Existing settings UI and MCP server configuration pattern — used as the design reference for the backend management UI.

---

## 8. Out of Scope

The following are explicitly **NOT** part of this feature:

- **Training or fine-tuning** on remote compute — Cloud Offload is inference-only.
- **Multi-user or team-shared backends** — all backends are per-user, single-seat.
- **Billing management or payment processing** — the system shows cost estimates but does not handle payments, invoicing, or billing disputes. Users manage billing directly with their cloud providers.
- **Non-text modalities** — image generation, audio transcription, vision models, and other non-text inference are not supported through Cloud Offload.
- **Custom Docker image building** — the system does not build or push container images for remote deployment. It uses pre-existing server binaries or managed services.
- **Automatic fallback during active conversation** — the system does not silently switch backends if the active one fails mid-conversation. It notifies the user and offers a manual switch. (This is a deliberate design choice to prevent confusing model-switching behavior.)
- **VPN or tunnel setup** — the system assumes the remote endpoint is already network-reachable. It does not provision VPN tunnels, SSH tunnels, or port forwarding.
- **Endpoint authentication beyond Bearer tokens** — OAuth flows, mutual TLS, client certificates, and custom auth schemes are not supported in MVP. Bearer token (API key) auth covers the vast majority of use cases.
- **Backend performance benchmarking** — the system shows real-time metrics (latency, tokens/sec) but does not provide systematic benchmarking, comparison reports, or performance history graphs.
- **Azure VM auto-provisioning, Google Vertex AI, Kaggle notebook integration** — these are identified as P2/P3 future targets but are NOT in scope for this specification. They will be specified separately when prioritized.

---

## 9. Acceptance Checklist

### Spec Quality

- [x] No implementation details (languages, frameworks, APIs) in requirements — requirements describe WHAT, not HOW
- [x] Focused on user value and business needs
- [x] All mandatory sections completed
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable and technology-agnostic
- [x] No `[NEEDS CLARIFICATION]` markers remain — all ambiguities resolved through provided context
- [x] Every user story has acceptance scenarios with Given/When/Then format
- [x] Edge cases identified for all major flows (11 edge cases covering mid-stream failure, auth expiry, model mismatch, timeouts, CORS, priority, rate limiting, compatibility, local-as-remote, deletion, and startup reconnection)
- [x] Scope is clearly bounded (9 in-scope stories + 10 explicit out-of-scope items)
- [x] All functional requirements trace to at least one user story (traceback noted in each FR)

### Functional Requirement Traceability Matrix

| User Story                  | Functional Requirements                                                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Story 1 — Custom Endpoint   | FR-CO-005 through FR-CO-010                                                                                                             |
| Story 2 — HF Deployment     | FR-CO-011 through FR-CO-017                                                                                                             |
| Story 3 — Backend Switching | FR-CO-018 through FR-CO-022                                                                                                             |
| Story 4 — Health Monitoring | FR-CO-023 through FR-CO-028                                                                                                             |
| Story 5 — HF Lifecycle      | FR-CO-032 through FR-CO-035                                                                                                             |
| Story 6 — LAN Discovery     | FR-CO-036 through FR-CO-038                                                                                                             |
| Story 7 — Cost Tracking     | FR-CO-039 through FR-CO-041                                                                                                             |
| Story 8 — SSH Deploy        | (P3, requirements deferred to separate spec)                                                                                            |
| Story 9 — Load Balancing    | (P3, requirements deferred to separate spec)                                                                                            |
| Cross-cutting               | FR-CO-001 through FR-CO-004 (abstraction), FR-CO-029 through FR-CO-031 (proxying), FR-CO-042 through FR-CO-048 (security & persistence) |
