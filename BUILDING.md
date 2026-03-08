# Building HugBrowse

This guide covers everything you need to build HugBrowse from source on Windows.

## Prerequisites

| Requirement                        | Version      | Notes                                                                  |
| ---------------------------------- | ------------ | ---------------------------------------------------------------------- |
| **Node.js**                        | 18+          | [Download](https://nodejs.org/) — LTS recommended                      |
| **Rust**                           | 1.77.2+      | [Install via rustup](https://rustup.rs/) — use `stable-msvc` toolchain |
| **Visual Studio 2022 Build Tools** | 17.x         | With **C++ Desktop Development** workload                              |
| **Windows SDK**                    | 10.0.22621.0 | Installed via VS Build Tools installer                                 |

### Installing Rust

```bash
# Install rustup (if not already installed)
winget install Rustlang.Rustup

# Ensure the stable MSVC toolchain is active
rustup default stable-msvc
rustup update
```

### Installing Visual Studio Build Tools

1. Download [VS 2022 Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)
2. In the installer, select **Desktop development with C++**
3. In the right-hand panel, ensure **Windows SDK 10.0.22621.0** is checked
4. Complete the installation

## Build Steps

### 1. Clone the Repository

```bash
git clone https://github.com/SufficientDaikon/hugbrowse.git
cd hugbrowse
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Development Build (Hot Reload)

```bash
npm run tauri:dev
```

This starts the Vite dev server on `http://localhost:5173` and launches the Tauri window with hot module replacement enabled.

### 4. Production Build

```bash
npm run tauri:build
```

This compiles the React frontend, then builds the Rust backend in release mode with LTO and binary stripping for a minimal output size.

## Output Locations

| Build Type     | Location                                 |
| -------------- | ---------------------------------------- |
| Debug binary   | `src-tauri/target/debug/hugbrowse.exe`   |
| Release binary | `src-tauri/target/release/hugbrowse.exe` |
| MSI installer  | `src-tauri/target/release/bundle/msi/`   |
| NSIS installer | `src-tauri/target/release/bundle/nsis/`  |

## Troubleshooting

### MSVC Toolchain Not Detected

If the Rust compiler cannot find the MSVC linker or Windows SDK despite having VS Build Tools installed, this is usually caused by registry corruption in the Visual Studio installation metadata.

**Workaround:** Set the following environment variables manually to point directly at your Build Tools installation. Adjust the paths below if your VS installation is in a non-default location.

```powershell
# Visual Studio 2022 Build Tools paths (adjust version numbers as needed)
$VSBase = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools"
$MSVCVer = "14.43.34808"  # Check your installed version in VC\Tools\MSVC\
$SDKVer = "10.0.22621.0"
$SDKBase = "C:\Program Files (x86)\Windows Kits\10"

# Set LIB
$env:LIB = @(
    "$VSBase\VC\Tools\MSVC\$MSVCVer\lib\x64",
    "$SDKBase\Lib\$SDKVer\um\x64",
    "$SDKBase\Lib\$SDKVer\ucrt\x64"
) -join ";"

# Set INCLUDE
$env:INCLUDE = @(
    "$VSBase\VC\Tools\MSVC\$MSVCVer\include",
    "$SDKBase\Include\$SDKVer\ucrt",
    "$SDKBase\Include\$SDKVer\um",
    "$SDKBase\Include\$SDKVer\shared"
) -join ";"

# Set PATH (prepend MSVC and SDK bin directories)
$env:PATH = @(
    "$VSBase\VC\Tools\MSVC\$MSVCVer\bin\Hostx64\x64",
    "$SDKBase\bin\$SDKVer\x64",
    $env:PATH
) -join ";"

# Increase Rust stack size (helps with deeply recursive macro expansions)
$env:RUST_MIN_STACK = "8388608"
```

After setting these variables in your terminal session, retry the build with `npm run tauri:build`.

### Frontend Build Errors

```bash
# Clear the Vite cache and rebuild
rm -rf dist node_modules/.vite
npm run build
```

### Rust Compilation Errors

```bash
# Clean the Rust build cache
cd src-tauri
cargo clean
cd ..
npm run tauri:build
```

### Port 5173 Already in Use

If `npm run tauri:dev` fails because port 5173 is occupied:

```powershell
# Find the process using port 5173
netstat -ano | findstr :5173

# Terminate it (replace <PID> with the actual process ID)
Stop-Process -Id <PID>
```

## Additional Commands

| Command               | Description                           |
| --------------------- | ------------------------------------- |
| `npm run dev`         | Start Vite dev server only (no Tauri) |
| `npm run build`       | Build frontend only                   |
| `npm run lint`        | Run ESLint                            |
| `npm run preview`     | Preview production frontend build     |
| `npm run tauri:dev`   | Full dev build with Tauri window      |
| `npm run tauri:build` | Full production build with installers |
