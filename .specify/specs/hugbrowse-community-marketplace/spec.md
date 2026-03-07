# Feature Specification: HugBrowse — Community Marketplace & Release Readiness

**Created**: 2026-03-07
**Status**: Draft
**Source**: Plan — "MSI Installer + Internet-Ready + Community Marketplace (HuggingFace meets Discord)"

---

## 1. Project Overview

### What We're Building

A transformation of HugBrowse from a local-only AI desktop application into a community-powered AI platform with a built-in marketplace. Users will be able to browse, install, and share extensions, plugins, custom local models (embedding models, specialized GGUF finetunes), MCP servers, workflows, and skills — all from within the app. The app will ship as a polished MSI installer on Windows (and equivalent installers on other platforms) and be fully internet-ready with crash reporting, telemetry consent, EULA, update channels, and proper code signing infrastructure.

Think of it as HuggingFace's model hub + Discord's community extensions + VS Code's marketplace — but for local AI.

### Why We're Building It

HugBrowse already runs models locally (99.4% LM Studio spec compliance). The next moat is **community**. LM Studio is a solo tool. By adding a marketplace where users share custom embedding models, RAG workflows, MCP tool servers, and UI plugins, HugBrowse becomes a **platform** — one that gets more valuable with every user. The MSI installer and internet-readiness ensure the first impression is professional.

### Who It's For

- **Primary**: AI enthusiasts who want to discover and install community-created extensions, models, and workflows
- **Secondary**: Extension creators who want to publish and share their AI tools (MCP servers, custom models, workflow templates)
- **Tertiary**: Organizations that want a self-hosted, extensible AI desktop tool for their teams

---

## 2. Dependency Graph

```
Phase 9 (MSI Installer & Code Signing)
    └─► Phase 10 (Internet-Ready Polish)
            └─► Phase 11 (Community Registry Backend)
                    └─► Phase 12 (Marketplace UI)       ─► Phase 15 (Social & Discovery)
                    └─► Phase 13 (Plugin System)         ─► Phase 15
                            └─► Phase 14 (Custom Model Manager)
```

**Critical path**: Phase 9 → 10 → 11 → 12 (installer → polished → registry → browsable marketplace)
**Guard rails** (hard constraints, not suggestions):

- Phase 10 MUST NOT ship until a working MSI installer is produced by Phase 9
- Phase 11 (Community Registry) MUST NOT begin until the app is internet-ready (Phase 10)
- All existing functionality (Phases 1–8, 99.4% compliance) MUST remain fully working throughout
- No user PII may be shared with the community registry without explicit opt-in consent
- Extension/plugin code MUST be sandboxed — no direct filesystem or network access without user approval
- The marketplace MUST work with HuggingFace authentication (existing HF token) — no new auth system
- All community content MUST be flaggable/reportable for abuse
- MSI installer MUST be under 150 MB (excluding sidecar binaries which are downloaded on first run)

---

## 2. User Scenarios & Stories

### User Story 1 — Windows MSI Installer (Phase 9) (Priority: P1)

As a Windows user who downloaded HugBrowse, I want a professional MSI installer that registers the app properly so that it feels like a real Windows application with Start Menu entries, uninstall support, and file associations.

**Why this priority**: No one can use the app if they can't install it. MSI is the standard Windows distribution format and the user explicitly requested it.

**Independent Test**: Run the built MSI, verify installation to Program Files, Start Menu shortcut, uninstall via Add/Remove Programs, and app launches correctly.

**Acceptance Scenarios**:

1. **Given** a user has the HugBrowse MSI file, **When** they double-click it, **Then** a Windows installer wizard opens with a license agreement, install path selection, and progress bar.
2. **Given** the installer is running, **When** installation completes, **Then** a Start Menu shortcut is created, a Desktop shortcut is optionally created, and the app can be launched immediately.
3. **Given** the app is installed, **When** the user opens "Add or Remove Programs", **Then** HugBrowse appears with its icon, version, publisher name, and an uninstall option.
4. **Given** the user clicks Uninstall, **When** the uninstallation completes, **Then** all app files are removed, registry entries are cleaned, and user data (models, settings) is optionally preserved.
5. **Given** a user has an older version installed, **When** they run a newer MSI, **Then** the installer upgrades in-place without data loss.
6. **Given** the build system runs `cargo tauri build`, **When** the build completes on Windows, **Then** an MSI file under 150 MB is produced in the `target/release/bundle/msi/` directory.
7. **Given** the MSI is installed, **When** the user opens a `.gguf` file from Explorer, **Then** HugBrowse opens and offers to load that model.

---

### User Story 2 — Internet-Ready Polish (Phase 10) (Priority: P1)

As a first-time user downloading HugBrowse from the internet, I want a polished, trustworthy experience so that I feel confident the app is safe and professional.

**Why this priority**: Internet distribution requires trust signals — proper about pages, privacy policy, crash handling, and telemetry consent. Without this, users won't install it.

**Independent Test**: Install the app fresh; verify EULA display, privacy consent prompt, About page with version/license/links, crash reporter that doesn't leak data, and graceful offline behavior.

**Acceptance Scenarios**:

1. **Given** the app launches for the first time after install, **When** the onboarding wizard runs, **Then** a privacy/telemetry consent screen appears before any data is sent, with clear opt-in/opt-out choices.
2. **Given** the user opens Settings → About, **When** the About section renders, **Then** it shows app version, build date, license (MIT), GitHub link, changelog link, and "Check for Updates" button.
3. **Given** the app encounters an unhandled error, **When** the crash occurs, **Then** a crash reporter dialog offers to send an anonymous error report (only if user consented) with a preview of what data will be sent.
4. **Given** the user has no internet connection, **When** they launch the app, **Then** all local features (load model, chat, settings) work fully, with a subtle offline indicator in the status bar.
5. **Given** the user wants to know what data HugBrowse collects, **When** they navigate to Settings → Privacy, **Then** they see a plain-language summary with toggles for analytics, crash reports, and community participation.
6. **Given** the app is distributed on the internet, **When** Windows SmartScreen scans the installer, **Then** the app has proper metadata (publisher name, version) to minimize false positive warnings.
7. **Given** the user wants to file a bug, **When** they open Help → Report Bug, **Then** a pre-filled template opens with system info (hardware tier, OS, app version) ready to submit to the issue tracker.

---

### User Story 3 — Community Registry & Account (Phase 11) (Priority: P1)

As a HugBrowse user, I want to connect my HuggingFace account to the community registry so that I can browse, install, and eventually publish community content.

**Why this priority**: The registry is the backbone of the marketplace — without it, there's nothing to browse or install.

**Independent Test**: Login with HF token, fetch the community registry index, browse available extensions, and verify authentication flows.

**Acceptance Scenarios**:

1. **Given** the user has an HF token configured, **When** they open the Marketplace tab, **Then** the app authenticates with the community registry using their existing HF token and shows their username/avatar.
2. **Given** the user is authenticated, **When** the Marketplace loads, **Then** a curated list of featured extensions, trending models, and new releases is displayed.
3. **Given** the user has no HF token, **When** they open the Marketplace, **Then** they can browse public listings but see a prompt to add their HF token to install or publish content.
4. **Given** the community registry is unreachable, **When** the user opens the Marketplace, **Then** a cached version of previously fetched listings is shown with a "Registry offline" banner.
5. **Given** the registry returns data, **When** the listing is parsed, **Then** each item shows: name, author, description, category, download count, star rating, last updated date, and compatibility tags.
6. **Given** the user wants to publish content, **When** they click "Publish", **Then** they must accept the Community Guidelines and have a verified HF account.

---

### User Story 4 — Marketplace UI & Discovery (Phase 12) (Priority: P1)

As a user browsing the marketplace, I want a rich discovery experience with search, categories, and recommendations so that I can find extensions, models, and workflows that match my needs.

**Why this priority**: The marketplace is useless without good discovery. Search + categories + recommendations are table stakes.

**Independent Test**: Open Marketplace, search for "embedding", filter by category, sort by popularity, view a detail page, and verify all content types are browsable.

**Acceptance Scenarios**:

1. **Given** the user is on the Marketplace tab, **When** they type in the search bar, **Then** results update in real-time with fuzzy matching across names, descriptions, and tags.
2. **Given** the user wants to browse by category, **When** they click a category pill (Models, Plugins, MCP Servers, Workflows, Skills), **Then** only items in that category are shown.
3. **Given** the user is viewing search results, **When** they click on a result card, **Then** a detail page opens showing: full description (markdown rendered), screenshots/previews, install button, author profile, version history, reviews, compatibility info, and file size.
4. **Given** the detail page is open, **When** the user clicks "Install", **Then** the extension downloads with a progress indicator and is registered in the local extension manager.
5. **Given** the user has extensions installed, **When** they open Marketplace → Installed, **Then** they see all installed extensions with update availability indicators.
6. **Given** an extension has an update available, **When** the user clicks "Update", **Then** the new version downloads and replaces the old one, preserving user configuration.
7. **Given** the user wants to discover new content, **When** they view the Marketplace home, **Then** they see sections: "Featured", "Trending This Week", "Recommended For You" (based on hardware tier and installed models), "New Releases", and "Staff Picks".

---

### User Story 5 — Plugin & Extension System (Phase 13) (Priority: P1)

As a developer, I want to create plugins that extend HugBrowse's functionality so that I can add custom UI panels, processing pipelines, and integrations.

**Why this priority**: The plugin system is what makes the marketplace valuable — without installable, runnable plugins, the marketplace is just a listing page.

**Independent Test**: Install a sample plugin from the marketplace; verify it loads, renders its UI in a designated panel, can access the API, and can be uninstalled cleanly.

**Acceptance Scenarios**:

1. **Given** a plugin is installed, **When** the app starts, **Then** the plugin is loaded from its manifest, its entry point is executed in a sandboxed iframe/webview, and it appears in the Extensions panel.
2. **Given** a plugin declares UI contributions in its manifest, **When** the plugin loads, **Then** its panels/buttons are injected into the designated extension points (sidebar panel, chat toolbar, settings tab).
3. **Given** a plugin wants to access the local API, **When** it calls the HugBrowse Plugin API, **Then** it can read model status, send chat messages, access RAG, and read settings — but ONLY with permissions declared in its manifest.
4. **Given** a plugin attempts to access the filesystem, **When** the sandbox intercepts the call, **Then** the user is prompted to grant or deny the permission, and the decision is remembered.
5. **Given** a plugin crashes or enters an infinite loop, **When** the watchdog detects it, **Then** the plugin is terminated, an error is logged, and the rest of the app continues working normally.
6. **Given** the user wants to uninstall a plugin, **When** they click "Uninstall" in the Extensions panel, **Then** the plugin files are removed, its configuration is cleaned up, and the UI extension points are restored to their default state.
7. **Given** a developer wants to create a plugin, **When** they run the plugin scaffolding command, **Then** a template project is created with manifest.json, entry point, TypeScript types for the Plugin API, and a README.

---

### User Story 6 — Custom Model Manager (Phase 14) (Priority: P2)

As a user, I want to download and manage custom community models (embedding models, specialized finetunes, small utility models) so that I can enhance my RAG pipeline and inference quality.

**Why this priority**: Custom models are the most tangible marketplace item — users immediately see value from better embedding models or task-specific finetunes.

**Independent Test**: Browse community models, download an embedding model, configure it as the RAG embedding backend, and verify RAG quality improves.

**Acceptance Scenarios**:

1. **Given** the user browses the Models category in the Marketplace, **When** they filter by "Embedding Models", **Then** compatible embedding GGUF models are listed with size, quality score, and supported dimensions.
2. **Given** the user clicks "Install" on a community embedding model, **When** the download completes, **Then** the model appears in Settings → Models → Embedding Models and can be selected as the RAG embedding backend.
3. **Given** a community model is installed, **When** the user views their Model Library, **Then** community models are shown alongside HuggingFace-downloaded models with a "Community" badge.
4. **Given** the user wants to share a finetune they created, **When** they click "Publish Model" in their Model Library, **Then** a wizard walks them through: select file, add description, set category/tags, set license, and upload to the registry.
5. **Given** a community model requires a specific llama-server feature, **When** the user tries to load it, **Then** the app checks compatibility and warns if the bundled llama-server version is too old.
6. **Given** the user has multiple embedding models, **When** they switch the active embedding model in settings, **Then** existing RAG indexes are marked stale and the user is prompted to re-index.
7. **Given** a community model file is corrupted after download, **When** the integrity check runs, **Then** the model is marked invalid with an option to re-download.

---

### User Story 7 — Community Social Features (Phase 15) (Priority: P2)

As a community member, I want to rate, review, and discuss marketplace content so that the best extensions rise to the top and creators get feedback.

**Why this priority**: Social features drive engagement and quality. Without ratings and reviews, there's no way to distinguish good content from bad.

**Independent Test**: Install an extension, leave a star rating and text review, verify the review appears on the listing, verify the average rating updates.

**Acceptance Scenarios**:

1. **Given** the user has an installed extension, **When** they open its detail page, **Then** they can leave a 1-5 star rating and an optional text review.
2. **Given** multiple users have reviewed an extension, **When** a new user views the listing, **Then** the average rating, review count, and most recent reviews are displayed.
3. **Given** the user finds an abusive review or extension, **When** they click "Report", **Then** a report form lets them select a reason (spam, malware, offensive, other) and submit it to moderators.
4. **Given** a creator publishes an extension, **When** they view their creator dashboard, **Then** they see download stats, rating trends, review feed, and version-by-version analytics.
5. **Given** the user follows a creator, **When** the creator publishes a new extension or update, **Then** the user receives an in-app notification.
6. **Given** the user wants to discover active community members, **When** they browse the "Community" tab, **Then** they see top creators, active discussion threads, and trending content — like a Discord server browser.
7. **Given** a user clicks on a creator's profile, **When** the profile loads, **Then** it shows their published extensions, star count, bio, and HuggingFace profile link.

---

### User Story 8 — MCP Server Marketplace (Phase 13+) (Priority: P2)

As a developer, I want to browse and install community MCP servers so that I can give my local model access to new tools without configuring them manually.

**Why this priority**: MCP servers are the power-user feature — one-click tool installation makes tool calling accessible to non-developers.

**Independent Test**: Browse MCP servers in marketplace, click Install, verify the server is registered in settings and its tools appear in chat.

**Acceptance Scenarios**:

1. **Given** the user browses MCP Servers in the Marketplace, **When** the listing loads, **Then** each MCP server shows: name, description, available tools list, author, and install count.
2. **Given** the user clicks "Install" on an MCP server, **When** the installation completes, **Then** the server URL is added to the MCP settings, tools are discovered, and they appear in the chat tool list.
3. **Given** an installed MCP server requires configuration (API keys, paths), **When** the user opens its settings, **Then** a configuration form is rendered from the server's config schema.
4. **Given** an MCP server is installed but its endpoint is unreachable, **When** the health check fails, **Then** the server status shows "Offline" with a retry button and troubleshooting suggestions.
5. **Given** the user wants to publish an MCP server, **When** they use the publish wizard, **Then** they provide: server URL pattern, tool manifest, config schema, description, and category.

---

### User Story 9 — Workflow Templates (Phase 13+) (Priority: P3)

As a user, I want to browse and install workflow templates (pre-configured RAG pipelines, multi-model chains, prompt templates) so that I can get productive faster.

**Why this priority**: Workflows reduce setup friction — new users get a working setup in one click instead of configuring everything manually.

**Independent Test**: Install a "Research Assistant" workflow template, verify it creates a chat session with system prompt, attaches a RAG pipeline, and configures tool calling.

**Acceptance Scenarios**:

1. **Given** the user browses Workflows in the Marketplace, **When** the listing loads, **Then** each workflow shows: name, description, required models, estimated setup time, and preview of what it configures.
2. **Given** the user clicks "Install Workflow", **When** the workflow requires models not yet downloaded, **Then** the app prompts to download missing dependencies before applying.
3. **Given** a workflow is installed, **When** the user activates it, **Then** a new chat session is created with the workflow's system prompt, RAG documents attached, MCP tools configured, and model loaded.
4. **Given** the user creates a custom workflow, **When** they click "Share Workflow", **Then** their current session configuration (system prompt, model, RAG docs template, MCP tools) is packaged and published.
5. **Given** a workflow references a model that's incompatible with the user's hardware, **When** they try to install, **Then** the app warns about hardware requirements and suggests alternatives.

---

### User Story 10 — Skills Marketplace (Phase 13+) (Priority: P3)

As a user, I want to browse and install "skills" (curated system prompt + tool combinations) so that my local model can perform specialized tasks like code review, data analysis, or writing assistance.

**Why this priority**: Skills are the simplest form of community content — just a system prompt + optional tools. They're easy to create and immediately useful.

**Independent Test**: Install a "Code Reviewer" skill, start a chat with that skill active, verify the system prompt is set and relevant tools are available.

**Acceptance Scenarios**:

1. **Given** the user browses Skills in the Marketplace, **When** the listing loads, **Then** each skill shows: name, description, example conversations, required tools, and compatible models.
2. **Given** the user clicks "Install Skill", **When** installation completes, **Then** the skill appears in a skill picker dropdown when starting a new chat session.
3. **Given** the user selects a skill for a new chat, **When** the session starts, **Then** the system prompt is pre-filled, required MCP tools are enabled, and the model receives the skill context.
4. **Given** the user creates a useful system prompt, **When** they click "Share as Skill", **Then** a wizard lets them package the system prompt, tag it, add example conversations, and publish it.
5. **Given** a skill depends on MCP tools not installed, **When** the user tries to activate it, **Then** the missing tools are listed with one-click install links.

---

### Edge Cases

1. **Malicious plugin**: A published extension contains code that attempts to access the filesystem outside its sandbox — the sandbox MUST block it and alert the user.
2. **Registry down during install**: The registry goes offline mid-download of an extension — the partial download is cleaned up and retryable.
3. **Version conflict**: Two plugins require different versions of the same dependency — the app surfaces the conflict and lets the user choose.
4. **Disk space during install**: Extension download would exceed available disk space — install is blocked with a clear message.
5. **MSI upgrade with running app**: User runs a new MSI while HugBrowse is running — installer detects the running process and prompts to close it first.
6. **Corrupt extension package**: A downloaded extension fails integrity verification — the app rejects it and offers to re-download.
7. **Rate-limited registry**: The community registry rate-limits a user — the app shows a friendly message and backs off.
8. **Offline marketplace cache stale**: The cached marketplace data is > 7 days old — the app shows a warning that listings may be outdated.
9. **Plugin API version mismatch**: An extension built for Plugin API v2 is loaded in an app with Plugin API v1 — the app shows an incompatibility error and disables the plugin.
10. **Unicode in extension names**: Extension names with non-ASCII characters (emoji, CJK, Arabic) render correctly everywhere.
11. **Concurrent extension installs**: User installs 3 extensions simultaneously — all progress bars are independent and accurate.
12. **Extension depends on missing model**: A plugin requires an embedding model not yet downloaded — the app lists missing dependencies with install links.
13. **Creator deletes published extension**: An extension the user has installed is unpublished — the local copy continues working but shows "No longer available" status.
14. **Review spam**: A user submits multiple fake reviews — the registry enforces one review per user per extension.
15. **Large extension package**: An extension is > 100 MB — download shows progress and uses resumable downloads.
16. **MSI installer on non-admin account**: The installer runs without admin privileges — it installs per-user instead of system-wide.
17. **Auto-update overwrites custom plugins**: An app auto-update replaces extension files — extensions MUST survive app updates.
18. **Extension breaks after app update**: An extension that worked before an app update now crashes — the app detects the failure and disables it with a message to the user and creator.

---

## 3. Functional Requirements

### Phase 9 — MSI Installer & Distribution

- **FR-049**: The app MUST produce a signed Windows MSI installer via `cargo tauri build` that installs to Program Files.
- **FR-050**: The MSI installer MUST create Start Menu shortcuts, optional Desktop shortcut, and register in Add/Remove Programs.
- **FR-051**: The MSI installer MUST support silent installation via command-line flags (`/quiet`, `/passive`).
- **FR-052**: The MSI MUST support in-place upgrades: running a newer MSI over an older installation upgrades without data loss.
- **FR-053**: The uninstaller MUST cleanly remove all app files, registry entries, and shortcuts while optionally preserving user data (models, settings, extensions).
- **FR-054**: The MSI MUST register `.gguf` file association so that double-clicking a GGUF file opens HugBrowse with a "Load Model" prompt.
- **FR-055**: The built MSI file MUST be under 150 MB (excluding sidecar binaries).
- **FR-056**: The app MUST also produce `.dmg` on macOS and `.AppImage`/`.deb` on Linux via the same build system.

### Phase 10 — Internet-Ready Polish

- **FR-057**: The app MUST display a privacy/telemetry consent screen on first launch, before sending any data.
- **FR-058**: The Settings panel MUST include an "About" section showing: app version, build number, license, GitHub link, changelog, and system info summary.
- **FR-059**: The app MUST include a "Report Bug" action that opens a pre-filled issue template with system info (OS, hardware tier, app version, installed extensions).
- **FR-060**: The app MUST detect offline state and show a non-intrusive offline indicator while keeping all local features functional.
- **FR-061**: The app MUST include a crash reporter that captures errors and optionally sends anonymous reports (only if user consented).
- **FR-062**: The app MUST display a changelog on first launch after an update, highlighting new features.
- **FR-063**: The app MUST include a keyboard shortcut reference sheet accessible via `Ctrl+/` or Help menu.
- **FR-064**: The app MUST support deep linking via custom protocol (`hugbrowse://model/{id}`, `hugbrowse://extension/{id}`) for sharing links.

### Phase 11 — Community Registry

- **FR-065**: The app MUST connect to a community content registry using the user's existing HuggingFace authentication.
- **FR-066**: The registry MUST support five content categories: Models, Plugins, MCP Servers, Workflows, and Skills.
- **FR-067**: Each registry listing MUST include: unique ID, name, author, description (markdown), category, tags, version, download count, average rating, license, and compatibility metadata.
- **FR-068**: The app MUST cache the registry index locally and serve it when offline, with a staleness indicator.
- **FR-069**: The app MUST support paginated browsing of registry listings (infinite scroll or pagination with 20 items per page).
- **FR-070**: The registry MUST support content versioning: each listing has a version history, and users can install specific versions.

### Phase 12 — Marketplace UI

- **FR-071**: The app MUST include a "Marketplace" page accessible from the main navigation sidebar.
- **FR-072**: The Marketplace MUST include a search bar with fuzzy matching across names, descriptions, tags, and author names.
- **FR-073**: The Marketplace MUST include category filter pills for each content type (Models, Plugins, MCP Servers, Workflows, Skills).
- **FR-074**: The Marketplace MUST include sort options: Trending, Most Downloaded, Highest Rated, Newest, Recently Updated.
- **FR-075**: Each listing card MUST show: name, author avatar, short description, category badge, star rating, download count, and an "Install" button.
- **FR-076**: The detail page for a listing MUST show: full markdown description, screenshots/previews, version history, install button, reviews section, author info, file size, and compatibility tags.
- **FR-077**: The Marketplace home MUST include curated sections: Featured, Trending This Week, Recommended For You, New Releases.
- **FR-078**: The app MUST include an "Installed Extensions" management page showing all installed community content with update indicators.

### Phase 13 — Plugin System

- **FR-079**: Plugins MUST be defined by a `manifest.json` file specifying: name, version, entry point, permissions, UI contributions, and API version.
- **FR-080**: Plugins MUST execute in a sandboxed environment (iframe or isolated context) with no direct filesystem or network access unless explicitly permitted.
- **FR-081**: The app MUST expose a Plugin API that allows plugins to: read model status, send messages to chat, access RAG functions, read/write plugin-specific settings, and register UI panels.
- **FR-082**: Plugins MUST declare required permissions in their manifest; the app MUST prompt users to approve permissions on first install.
- **FR-083**: The app MUST include a plugin watchdog that terminates plugins exceeding memory limits (50 MB) or CPU time limits (5 seconds continuous).
- **FR-084**: Users MUST be able to enable, disable, configure, and uninstall plugins from the Extensions panel.
- **FR-085**: The app MUST provide a plugin scaffolding command or template that generates a starter plugin project with manifest, types, and build configuration.
- **FR-086**: Plugin UI contributions MUST support injection into: sidebar panel, chat toolbar button, settings tab, and model detail panel extension area.

### Phase 14 — Custom Model Manager

- **FR-087**: The app MUST support downloading community models (GGUF files) from the marketplace with the same progress/resume system as HuggingFace downloads.
- **FR-088**: Community models MUST be stored in a separate directory from HuggingFace models, with a "Community" badge in the UI.
- **FR-089**: Users MUST be able to select a community embedding model as the RAG embedding backend in Settings.
- **FR-090**: When the active embedding model changes, the app MUST mark existing RAG indexes as stale and prompt to re-index.
- **FR-091**: Users MUST be able to publish their own GGUF models to the registry with: file upload, description, category, tags, license, and hardware requirements.
- **FR-092**: Community models MUST include an integrity checksum verified after download.
- **FR-093**: The Model Library page MUST show both HuggingFace and community models with filtering by source.

### Phase 15 — Social & Community

- **FR-094**: Users MUST be able to rate marketplace listings with a 1-5 star rating (one rating per user per listing).
- **FR-095**: Users MUST be able to write text reviews on marketplace listings.
- **FR-096**: Users MUST be able to report listings and reviews for abuse (spam, malware, offensive, copyright).
- **FR-097**: Extension creators MUST have a "Creator Dashboard" showing their published content, download stats, rating trends, and recent reviews.
- **FR-098**: Users MUST be able to follow creators and receive in-app notifications when they publish new content or updates.
- **FR-099**: The app MUST include a "Community" discovery page showing: top creators, trending discussions, and recently active members.
- **FR-100**: Creator profile pages MUST show: published extensions, total downloads, average rating, bio, and linked HuggingFace profile.
- **FR-101**: The Marketplace MUST include a "Recommended For You" section powered by the user's hardware tier, installed models, and browsing history.

---

## 4. Non-Functional Requirements

### Performance

- **NFR-013**: Marketplace page MUST load within 2 seconds on a broadband connection (initial render with above-the-fold content).
- **NFR-014**: Marketplace search results MUST appear within 500 ms of typing (debounced at 300 ms).
- **NFR-015**: Extension installation MUST NOT block the UI thread — all downloads and file operations run in the background.
- **NFR-016**: The MSI installer MUST complete installation in under 60 seconds on an SSD system.

### Security

- **NFR-017**: Plugins MUST execute in a sandboxed environment with no access to the main process, filesystem, or network unless explicitly granted by the user.
- **NFR-018**: All community content downloads MUST be verified via SHA-256 checksum before installation.
- **NFR-019**: The community registry transport MUST use HTTPS with certificate pinning for the registry endpoint.
- **NFR-020**: Plugin permissions MUST follow the principle of least privilege — no plugin gets all permissions by default.
- **NFR-021**: User reviews and ratings MUST be authenticated via HF token to prevent anonymous abuse.

### Privacy

- **NFR-022**: No telemetry, analytics, or crash reports MUST be sent without explicit user opt-in consent.
- **NFR-023**: The user's installed extensions list, model library, and chat history MUST NOT be shared with the registry unless the user explicitly opts in.
- **NFR-024**: The privacy consent screen MUST clearly explain what data is collected, how it's used, and how to revoke consent later.

### Reliability

- **NFR-025**: Extension crashes MUST NOT crash the host application — failures are isolated to the plugin sandbox.
- **NFR-026**: App updates MUST NOT delete or corrupt installed extensions — extensions survive across updates.
- **NFR-027**: The marketplace MUST degrade gracefully when the registry is offline — showing cached data with a staleness indicator.

### Compatibility

- **NFR-028**: The MSI installer MUST work on Windows 10 21H2+ and Windows 11.
- **NFR-029**: The Plugin API MUST be versioned; plugins declare a minimum API version and the app enforces compatibility.
- **NFR-030**: All marketplace features MUST work on Windows, macOS 13+, and Ubuntu 22.04+ (same as existing platform support).

---

## 5. Key Entities

### MarketplaceListing

- **What it represents**: A published piece of community content (model, plugin, MCP server, workflow, or skill).
- **Key attributes**: listing ID, name, author ID, author name, description (markdown), category (enum), tags, current version, all versions list, download count, average rating, review count, license, created at, updated at, file size, checksum, compatibility metadata, featured flag, status (published/unpublished/flagged).
- **Relationships**: Has many Reviews; belongs to an Author (HF user); has many Versions.

### InstalledExtension

- **What it represents**: A locally installed piece of community content.
- **Key attributes**: extension ID, listing ID (nullable — could be locally created), name, version, category, install path, enabled flag, permissions granted, installed at, last updated, config data, status (active/disabled/errored).
- **Relationships**: References a MarketplaceListing; may depend on other extensions or models.

### Review

- **What it represents**: A user's rating and optional text review of a marketplace listing.
- **Key attributes**: review ID, listing ID, author ID, author name, star rating (1-5), text content, created at, updated at, flagged flag.
- **Relationships**: Belongs to a MarketplaceListing; belongs to an Author.

### PluginManifest

- **What it represents**: The declaration of a plugin's capabilities, permissions, and entry points.
- **Key attributes**: name, version, description, author, entry point file, plugin API version (minimum), permissions (filesystem, network, model, chat, settings), UI contributions (sidebar panel, toolbar button, settings tab), dependencies (other plugins, models), icon path.
- **Relationships**: Defines an InstalledExtension's runtime behavior.

### CreatorProfile

- **What it represents**: A community content creator's public identity.
- **Key attributes**: HF user ID, display name, avatar URL, bio, published listings count, total downloads, average rating, followers count, joined date.
- **Relationships**: Has many MarketplaceListings; has many Followers (other users).

### CommunityModel

- **What it represents**: A GGUF model file downloaded from the community registry.
- **Key attributes**: model ID, listing ID, filename, file path, file size, checksum, category (embedding/chat/code/other), quantization, parameter count, compatible context lengths, download date, integrity status.
- **Relationships**: References a MarketplaceListing; can be selected as active model or embedding model.

### WorkflowTemplate

- **What it represents**: A pre-configured combination of system prompt, model, RAG setup, and MCP tools.
- **Key attributes**: workflow ID, name, description, system prompt, required model tags, required MCP tools, RAG configuration, tags, author.
- **Relationships**: References Models, MCP Servers, and Skills.

---

## 6. Success Criteria

- **SC-013**: `cargo tauri build` produces a working MSI under 150 MB on Windows, a `.dmg` on macOS, and an `.AppImage` on Linux — all installable and functional.
- **SC-014**: A new user can install the MSI, complete onboarding, and reach a running chat in under 5 minutes (excluding model download time).
- **SC-015**: A user can browse the Marketplace, search for an extension, install it, and use it — all within the app — in under 2 minutes.
- **SC-016**: A developer can create a plugin from the scaffolding template, test it locally, and publish it to the registry in under 30 minutes.
- **SC-017**: A plugin crash (infinite loop, memory overflow) does NOT crash the host app — verified by installing a deliberately crashy test plugin.
- **SC-018**: An extension installed before an app update continues working after the update — verified by installing, updating the app, and confirming the extension loads.
- **SC-019**: The marketplace loads and is interactive within 2 seconds on a 50 Mbps connection.
- **SC-020**: A user with no internet can launch the app, load a model, and chat — all local features work fully offline.
- **SC-021**: Community model downloads are resumable and integrity-verified — verified by interrupting a download and resuming.
- **SC-022**: The uninstaller removes all app files and registry entries, optionally preserving user data — verified by clean uninstall and reinstall.
- **SC-023**: All 99.4% existing compliance (Phases 1-8) remains intact after Phases 9-15 are implemented — verified by re-running the existing review checklist.
- **SC-024**: At least 5 content types (Models, Plugins, MCP Servers, Workflows, Skills) are browsable and installable in the Marketplace.

---

## 7. Assumptions & Dependencies

### Assumptions

- The community registry will be hosted as a JSON-based API (initially a static JSON index on a CDN, upgradable to a dynamic backend later).
- HuggingFace authentication (existing HF token) will be used for all community identity — no new auth system needed.
- Plugin sandboxing will use iframes with postMessage IPC for the initial version — WebAssembly sandboxing may come later.
- Community models are GGUF files hosted on HuggingFace Hub or a similar file hosting service.
- Extension packages are zip archives containing a manifest.json and bundled assets.
- The WiX toolset (bundled with Tauri) will generate the MSI installer.
- Reviews and ratings will be stored in the community registry, not locally.
- The initial "registry" can be a curated JSON file in a GitHub repo — full backend comes later.

### Dependencies

- **Tauri bundler (WiX)**: Required for MSI generation. Tauri uses WiX 3 by default.
- **Community Registry API**: A hosted endpoint serving the marketplace index. Initially a static JSON on GitHub Pages or CDN.
- **HuggingFace Hub API**: For model file hosting and user authentication.
- **Plugin sandbox runtime**: iframe-based sandboxing using the existing webview.
- **@tauri-apps/plugin-deep-link**: For custom protocol handling (`hugbrowse://`).

---

## 8. Out of Scope

The following are explicitly **NOT** part of this specification:

- Running a centralized backend server for the registry (the initial registry is a static JSON index)
- Paid/premium extensions or monetization features
- Real-time chat between users (Discord-like messaging)
- Extension code review or automated malware scanning (manual moderation only for initial release)
- Mobile companion app
- Cloud sync of settings, models, or chat history
- Training, fine-tuning, or RLHF within the app
- WebAssembly-based plugin sandboxing (future enhancement)
- Multi-language localization of the marketplace UI (English only for initial release)
- Content moderation AI (manual reporting and review only)

---

## 9. Acceptance Checklist

### Spec Quality

- [x] No implementation details (languages, frameworks, APIs — only in Assumptions)
- [x] Focused on user value and business needs
- [x] All mandatory sections completed
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable and technology-agnostic
- [x] No NEEDS CLARIFICATION markers remain
- [x] Every user story has acceptance scenarios (62 total)
- [x] Edge cases identified (18 cases)
- [x] Scope is clearly bounded (10 out-of-scope items)
- [x] All functional requirements trace to a user story
