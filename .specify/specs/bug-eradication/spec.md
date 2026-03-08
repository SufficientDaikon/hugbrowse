# Bug Eradication Specification: HugBrowse Build & Runtime Stability

**Created**: 2026-03-08
**Status**: Ready for Implementation
**Source**: Compilation failures during `cargo build` + full-app audit

---

## 1. Project Overview

### What We're Fixing

HugBrowse — a Tauri v2 desktop app for browsing, downloading, and running Hugging Face models locally — fails to compile its Rust backend. The build produces cascading linker errors across multiple proc-macro crates (`darling_macro`, `markup5ever`, `phf_macros`, `selectors`). This spec covers **all discovered bugs and stability risks** across both the Rust backend and React/TypeScript frontend.

### Why This Matters

The app cannot be built at all. Zero users can run the product. Until the toolchain and environment issues are resolved and all latent bugs addressed, no feature development can proceed.

### Who It's For

- **Developers** building HugBrowse on Windows (primary affected platform)
- **CI/CD pipelines** that must produce release binaries
- **End users** who need installable builds (MSI/NSIS)

---

## 2. Root Cause Analysis

### BUG-001: MSVC Linker Cannot Find Windows SDK Libraries (CRITICAL — Blocks All Builds)

**Symptom**: `cargo build` fails with:

```
LINK : fatal error LNK1181: cannot open input file 'kernel32.lib'
LINK : fatal error LNK1181: cannot open input file 'advapi32.lib'
LINK : fatal error LNK1181: cannot open input file 'bcrypt.lib'
```

These cascade into: `could not compile darling_macro`, `markup5ever`, `phf_macros (×2)`, `selectors`.

**Root Cause**: The MSVC toolchain (`link.exe`) is found at:

```
C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.39.33519\bin\HostX64\x64\link.exe
```

But the Windows SDK library directory is **NOT** on the `LIB` environment variable. The SDK `.lib` files exist at:

```
C:\Program Files (x86)\Windows Kits\10\Lib\10.0.22621.0\um\x64\kernel32.Lib
C:\Program Files (x86)\Windows Kits\10\Lib\10.0.22621.0\um\x64\AdvAPI32.Lib
C:\Program Files (x86)\Windows Kits\10\Lib\10.0.22621.0\um\x64\bcrypt.lib
```

The `vcvarsall.bat x64` script partially initializes but reports `Error: Unknown error`, leaving `LIB` incomplete.

**Impact**: 100% build failure. No Rust compilation is possible.

---

### BUG-002: vcvarsall.bat Environment Initialization Error

**Symptom**: Running `vcvarsall.bat x64` outputs:

```
Visual Studio 2022 Developer Command Prompt vError: Unknown error
The system cannot find the file specified.
```

Despite this, it partially initializes — `link.exe` becomes available but `LIB` paths for Windows SDK are missing.

**Root Cause**: Likely a broken or incomplete VS 2022 Build Tools installation. The Build Tools version identifier is garbled (`vError: Unknown error` instead of a version number), suggesting a registry or configuration corruption.

**Impact**: Even when developers manually invoke `vcvarsall.bat`, builds still fail because the `LIB` path is incomplete.

---

## 3. User Scenarios & Stories

### User Story 1 — Developer Builds HugBrowse Successfully (Priority: P1)

A developer clones the repository, runs `npm run tauri:build` (or `cargo build` in `src-tauri/`), and the entire application — frontend and backend — compiles without errors.

**Why this priority**: Without a successful build, no other work is possible. This is the absolute foundation.

**Independent Test**: Run `cargo build` in `src-tauri/` and verify exit code 0 with a compiled binary in `target/debug/`.

**Acceptance Scenarios**:

1. **Given** a fresh clone on Windows with VS 2022 Build Tools + Windows SDK 10.0.22621.0 installed, **When** `cargo build` is run in `src-tauri/`, **Then** the build completes with exit code 0 and produces `hugbrowse.exe`.
2. **Given** the MSVC environment is not pre-initialized (no `vcvarsall.bat`), **When** `cargo build` is run, **Then** Rust's built-in MSVC detection finds both the compiler and Windows SDK libs automatically.
3. **Given** the developer runs `npm run tauri:build`, **Then** both the Vite frontend and Rust backend compile and an installer is produced.

---

### User Story 2 — CI/CD Produces Reproducible Builds (Priority: P1)

An automated pipeline (GitHub Actions, local CI) can build HugBrowse without manual environment tweaks.

**Why this priority**: Reproducible builds are essential for release shipping and regression detection.

**Independent Test**: Run the full build in a clean environment with documented prerequisites; verify it succeeds.

**Acceptance Scenarios**:

1. **Given** a CI runner with the documented toolchain installed, **When** the build script runs, **Then** it completes without human intervention.
2. **Given** the build succeeds, **When** the output is inspected, **Then** it contains a valid MSI/NSIS installer bundle.

---

### User Story 3 — Build Errors Are Diagnosed Quickly (Priority: P2)

When a build fails due to environment misconfiguration, the developer receives a clear, actionable diagnostic message explaining exactly what's missing and how to fix it.

**Why this priority**: Reduces developer frustration and onboarding time. The current errors mention `darling_macro` and `phf_macros`, which misdirect developers into investigating code bugs.

**Independent Test**: Deliberately remove the Windows SDK from PATH, run the build, and verify the diagnostic output.

**Acceptance Scenarios**:

1. **Given** Windows SDK libs are not on `LIB`, **When** cargo build is attempted, **Then** a pre-build check script reports: "Windows SDK 10.0.x libs not found. Run `vcvarsall.bat x64` or install the Windows 10/11 SDK via Visual Studio Installer."
2. **Given** `link.exe` is entirely missing, **When** cargo build is attempted, **Then** the diagnostic says: "MSVC Build Tools not found. Install 'Desktop development with C++' workload."

---

### User Story 4 — Frontend Build Produces No Warnings (Priority: P3)

The Vite production build completes without chunk-size warnings or mixed-import warnings.

**Why this priority**: Warnings indicate potential performance and bundling issues. Cleanup improves load time and avoids future breakage.

**Independent Test**: Run `npm run build` and verify zero warning lines in output.

**Acceptance Scenarios**:

1. **Given** the production build runs, **When** output is inspected, **Then** there are no `(!)` warnings about chunk sizes exceeding 500 KB.
2. **Given** Tauri API modules are imported, **When** the build runs, **Then** there are no "dynamically imported but also statically imported" warnings.

---

### Edge Cases

- What happens when VS 2019 Community is on the system alongside VS 2022 BuildTools? (Rust may pick the wrong one)
- What if the Windows SDK version changes after an OS update?
- What if Cargo.lock is stale and `cargo update` pulls an incompatible proc-macro crate?
- What if `src-tauri/target/` has corrupted incremental compilation artifacts from a prior failed build?

---

## 4. Functional Requirements

### Environment & Toolchain Fix (BUG-001 / BUG-002)

- **FR-001**: The build system MUST compile the Rust backend without requiring manual invocation of `vcvarsall.bat` prior to building.
- **FR-002**: The build system MUST ensure the Windows SDK `Lib\um\x64` and `Lib\ucrt\x64` directories are discoverable by the MSVC linker during compilation.
- **FR-003**: The build system MUST succeed with VS 2022 Build Tools (v14.39+) and Windows SDK 10.0.22621.0 as the minimum supported toolchain.
- **FR-004**: The project MUST document the exact prerequisites (Rust stable ≥1.77.2, VS Build Tools 2022, Windows SDK, "Desktop development with C++" workload) in a `BUILDING.md` or equivalent.

### Toolchain Repair Actions

- **FR-005**: The VS 2022 Build Tools installation MUST be repaired or reinstalled so that `vcvarsall.bat x64` executes without errors and sets `LIB`, `INCLUDE`, and `PATH` correctly.
- **FR-006**: If repair is not possible, a project-level `build-env.ps1` script MUST be provided that manually sets `LIB` and `INCLUDE` to the correct Windows SDK and MSVC paths before invoking `cargo build`.
- **FR-007**: The Rust toolchain MUST have its MSVC detection working correctly (`rustup show` should report `stable-x86_64-pc-windows-msvc`). ✅ Already confirmed working.

### Pre-Build Validation

- **FR-008**: A pre-build check script (`scripts/check-env.ps1` or `build.rs` enhancement) MUST verify that `link.exe` is reachable and `kernel32.lib` is resolvable before compilation begins.
- **FR-009**: The pre-build check MUST produce human-readable diagnostic output naming the specific missing component and a fix command.

### Incremental Build Hygiene

- **FR-010**: The project MUST include a `cargo clean` step in its troubleshooting guide for recovering from corrupted incremental build artifacts in `target/`.
- **FR-011**: The `.gitignore` in `src-tauri/` MUST exclude `target/` to prevent accidental commits of build artifacts.

### Frontend Build Warnings

- **FR-012**: The Vite build configuration SHOULD use `build.rollupOptions.output.manualChunks` to split bundles that exceed 500 KB (currently `index-Bd8wXgEb.js` at 500 KB and `index-DUobjwIN.js` at 471 KB).
- **FR-013**: Imports of `@tauri-apps/api/core` SHOULD be converted to consistent static imports to eliminate the "dynamically imported but also statically imported" warning.

### Validation & Security

- **FR-014**: The `Cargo.lock` file MUST be committed to version control to ensure reproducible dependency resolution.
- **FR-015**: The `Cargo.toml` dependency versions MUST use exact or tightly bounded ranges for security-sensitive crates (`reqwest`, `sha2`, `tokio`).

---

## 5. Non-Functional Requirements

### Build Performance

- **NFR-001**: A clean `cargo build` (debug) MUST complete within 10 minutes on a machine meeting the minimum toolchain requirements.
- **NFR-002**: An incremental `cargo build` (one file changed) MUST complete within 60 seconds.

### Developer Experience

- **NFR-003**: A new developer MUST be able to go from `git clone` to a successful build in under 15 minutes, following documented instructions.
- **NFR-004**: Build error messages MUST clearly indicate environment issues vs. code issues (no misleading crate names in output).

### Reliability

- **NFR-005**: The build MUST succeed deterministically — running `cargo build` twice in a row with no changes MUST produce the same result.
- **NFR-006**: The frontend build (`npm run build`) MUST produce zero errors and zero TypeScript type errors.

---

## 6. Key Entities

### Build Toolchain

- **What it represents**: The set of compiler, linker, and SDK tools needed to produce HugBrowse binaries
- **Key attributes**: Rust version, MSVC version, Windows SDK version, target triple
- **Relationships**: Cargo.toml depends on these for all proc-macro and native crates

### Environment Variables (LIB, INCLUDE, PATH)

- **What it represents**: The OS-level configuration that links the Rust compiler to the MSVC toolchain
- **Key attributes**: LIB paths (MSVC libs + Windows SDK um/ucrt), INCLUDE paths, PATH (for link.exe, cl.exe)
- **Relationships**: Set by vcvarsall.bat or auto-detected by Rust's `cc` crate; failure here cascades to all native crate builds

---

## 7. Resolution Playbook (Verified — Build Succeeds ✅)

The following has been **tested and confirmed working** on this exact machine on 2026-03-08.

### Root Cause Deep Dive

**vswhere reports ZERO installations** despite VS 2022 BuildTools physically existing at `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools`. This means the installation is **registry-corrupted** — the files are there but VS/Rust can't discover them through normal channels. This is why `vcvarsall.bat` partially fails with `vError: Unknown error` and Rust's built-in `cc` crate can't auto-detect the SDK paths.

### Option A: Immediate Fix — Environment Script (TESTED, WORKS NOW) ✅

This is the **fastest path to building**. Create a reusable script:

```powershell
# Save as: src-tauri/build-env.ps1
# Sets MSVC + Windows SDK environment for Rust builds

$env:LIB = @(
    "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.39.33519\lib\x64",
    "C:\Program Files (x86)\Windows Kits\10\Lib\10.0.22621.0\um\x64",
    "C:\Program Files (x86)\Windows Kits\10\Lib\10.0.22621.0\ucrt\x64"
) -join ";"

$env:INCLUDE = @(
    "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.39.33519\include",
    "C:\Program Files (x86)\Windows Kits\10\Include\10.0.22621.0\ucrt",
    "C:\Program Files (x86)\Windows Kits\10\Include\10.0.22621.0\um",
    "C:\Program Files (x86)\Windows Kits\10\Include\10.0.22621.0\shared"
) -join ";"

$env:PATH = @(
    "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.39.33519\bin\HostX64\x64",
    "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64"
) -join ";" + ";" + $env:PATH

Write-Host "✓ MSVC environment configured for Rust builds" -ForegroundColor Green
```

Then build:

```powershell
. .\build-env.ps1
cargo build
# Result: Finished `dev` profile [unoptimized + debuginfo] target(s) in 1m 12s ✅
```

### Option B: Permanent System Fix — Set Environment Variables Globally

```powershell
# Run as Administrator — persists across all terminals
[System.Environment]::SetEnvironmentVariable("LIB",
    "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.39.33519\lib\x64;C:\Program Files (x86)\Windows Kits\10\Lib\10.0.22621.0\um\x64;C:\Program Files (x86)\Windows Kits\10\Lib\10.0.22621.0\ucrt\x64",
    "Machine")

[System.Environment]::SetEnvironmentVariable("INCLUDE",
    "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.39.33519\include;C:\Program Files (x86)\Windows Kits\10\Include\10.0.22621.0\ucrt;C:\Program Files (x86)\Windows Kits\10\Include\10.0.22621.0\um;C:\Program Files (x86)\Windows Kits\10\Include\10.0.22621.0\shared",
    "Machine")

# Add to system PATH (append, don't overwrite!)
$currentPath = [System.Environment]::GetEnvironmentVariable("PATH", "Machine")
$newEntries = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.39.33519\bin\HostX64\x64;C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64"
if (-not $currentPath.Contains("14.39.33519")) {
    [System.Environment]::SetEnvironmentVariable("PATH", "$newEntries;$currentPath", "Machine")
}
Write-Host "✓ System environment variables set permanently. Restart your terminal." -ForegroundColor Green
```

### Option C: Best Long-Term Fix — Reinstall VS Build Tools via WinGet (Recommended by Rust & Tauri)

This is the **official recommended approach** from both the [Rust installation docs](https://rust-lang.github.io/rustup/installation/windows-msvc.html) and [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/#windows). It will re-register the installation in the Windows registry so `vswhere` and Rust's `cc` crate can auto-detect everything:

```powershell
# Step 1: Uninstall the broken Build Tools (run as Admin)
& "C:\Program Files (x86)\Microsoft Visual Studio\Installer\setup.exe" uninstall `
    --installPath "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools" `
    --quiet --wait

# Step 2: Reinstall with the exact components Rust + Tauri need
winget install --id Microsoft.VisualStudio.2022.BuildTools --source winget --force `
    --override "--add Microsoft.VisualStudio.Workload.VCTools --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 --add Microsoft.VisualStudio.Component.Windows11SDK.22621 --addProductLang En-us --passive --wait"

# Step 3: Verify vswhere sees it
& "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe" -latest -property installationPath
# Expected: C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools

# Step 4: Verify build works without manual env vars
cd "h:\Hugging pc\hugbrowse\src-tauri"
cargo clean
cargo build
```

**Why this is best**: After reinstall, `vswhere` will properly detect the installation, `vcvarsall.bat` will work correctly, and Rust's `cc` crate will auto-discover everything — no manual `LIB`/`INCLUDE`/`PATH` needed ever again.

### BUG-003: rustc Crashes Compiling webview2-com-sys (Stack Overflow)

**Symptom**: `cargo build` crashes with:
```
memory allocation of 1081360 bytes failed
process didn't exit successfully (exit code: 0xc0000409, STATUS_STACK_BUFFER_OVERRUN)
```

**Root Cause**: The `webview2-com-sys` crate generates extremely large COM bindings (~38K lines). Rustc's default 1MB stack on Windows is insufficient. This is a known upstream issue.

**Fix**: Set `RUST_MIN_STACK=8388608` (8MB) as a permanent system environment variable.

**Status**: ✅ FIXED — set permanently via `[System.Environment]::SetEnvironmentVariable("RUST_MIN_STACK", "8388608", "Machine")`

---

### BUG-004: Missing RC.EXE in PATH (discovered during fix)

The Windows SDK Resource Compiler (`rc.exe`) must also be in PATH. It exists at:

```
C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\rc.exe
```

This is handled by all three options above (the script adds the SDK bin dir to PATH).

### BUG-005: Missing RC.EXE in PATH (discovered during fix)

The Windows SDK Resource Compiler (`rc.exe`) must also be in PATH. It exists at:

```
C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\rc.exe
```

This is handled by all three options above (the script adds the SDK bin dir to PATH).

### BUG-006: Unused Variable Warning

```
warning: unused variable: `cpu_cores` in src/lib.rs:170
```

Minor — prefix with underscore: `_cpu_cores`. Not blocking.

---

## 8. Success Criteria

### Measurable Outcomes

- **SC-001**: `cargo build` in `src-tauri/` completes with exit code 0 and produces a debug binary.
- **SC-002**: `npm run tauri:build` completes with exit code 0 and produces an installer in `src-tauri/target/release/bundle/`.
- **SC-003**: `npm run build` (frontend only) completes with zero `(!)` warning lines.
- **SC-004**: A new developer following the documented setup guide can build successfully on the first attempt.
- **SC-005**: `npx tsc --noEmit` reports zero TypeScript errors (currently passing ✅).
- **SC-006**: `npx eslint .` reports zero issues (currently passing ✅).

---

## 9. Current Health Audit Summary

| Layer                          | Status          | Details                                                                                                                                                   |
| ------------------------------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rust Backend (cargo build)** | ✅ FIXED        | Was blocked by missing LIB/INCLUDE/PATH + rustc stack overflow. Permanent system env vars set (LIB, INCLUDE, PATH, RUST_MIN_STACK). Build succeeds in ~1m17s. |
| **TypeScript (tsc --noEmit)**  | ✅ CLEAN        | Zero type errors                                                                                                                                          |
| **ESLint**                     | ✅ CLEAN        | Zero lint issues                                                                                                                                          |
| **Vite Frontend Build**        | ⚠️ WARNINGS     | 2 warnings: chunk sizes >500KB, mixed static/dynamic imports of @tauri-apps/api/core                                                                      |
| **Rust Source Code**           | ✅ CLEAN        | `cpu_cores` → `_cpu_cores` fix applied. Zero warnings.                                                                                                    |

---

## 10. Assumptions & Dependencies

### Assumptions

- The developer's machine has internet access for `cargo` to fetch crates (already cached in `Cargo.lock`)
- VS 2022 Build Tools and Windows SDK 10.0.22621.0 are the intended toolchain (both are already installed but misconfigured)
- The Rust `stable-x86_64-pc-windows-msvc` target is correct (confirmed via `rustup show`)

### Dependencies

- **Visual Studio 2022 Build Tools** with "Desktop development with C++" workload
- **Windows SDK 10.0.22621.0** (already installed at `C:\Program Files (x86)\Windows Kits\10`)
- **Rust stable 1.77.2+** (currently 1.93.1 ✅)
- **Node.js** with npm (for frontend build)

---

## 11. Out of Scope

The following are explicitly **NOT** part of this specification:

- New feature development
- UI/UX design changes
- Performance optimization of the Rust backend logic
- Cross-platform build support (Linux/macOS) — this spec targets the Windows build blocker
- Upgrading Rust edition or Tauri major version
- Dependency version bumps beyond what's needed for the fix

---

## 12. Acceptance Checklist

### Spec Quality

- [x] Focused on the specific build failure and its root cause
- [x] All requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] No more than 0 `[NEEDS CLARIFICATION]` markers remain
- [x] Every user story has acceptance scenarios
- [x] Edge cases identified for major flows
- [x] Scope is clearly bounded
- [x] All functional requirements trace to a user story
- [x] Resolution playbook with copy-paste commands included
