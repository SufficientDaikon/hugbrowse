//! Authentication & Security — Phase 3 of HugBrowse v1.0
//!
//! Token-based API authentication with granular permissions.
//! Tokens are hashed (SHA-256) before storage — plaintext shown once on creation.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;
use tokio::sync::Mutex;
use uuid::Uuid;

// ── Data Model ────────────────────────────────────────────────────────

/// Permission scopes for API tokens (Omega Spec §11.1).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Permission {
    Inference,
    ModelManagement,
    ServerAdmin,
    Downloads,
}

/// A stored API token (hash only — plaintext never stored).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiToken {
    pub id: String,
    pub name: String,
    pub token_hash: String,
    pub token_prefix: String, // first 8 chars for display
    pub permissions: Vec<Permission>,
    pub created_at: u64,
    pub last_used_at: Option<u64>,
    pub expires_at: Option<u64>,
    pub request_count: u64,
    pub is_active: bool,
}

/// Result of creating a new token — includes the plaintext (shown once).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenCreateResult {
    pub token: ApiToken,
    pub plaintext: String,
}

/// Auth configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthConfig {
    pub auth_required: bool,
}

impl Default for AuthConfig {
    fn default() -> Self {
        Self {
            auth_required: false,
        }
    }
}

/// The auth manager — holds all tokens and configuration.
pub struct AuthManager {
    pub tokens: HashMap<String, ApiToken>,
    pub config: AuthConfig,
}

pub type ManagedAuthManager = Arc<Mutex<AuthManager>>;

impl AuthManager {
    pub fn new() -> Self {
        Self {
            tokens: HashMap::new(),
            config: AuthConfig::default(),
        }
    }

    /// Validate a Bearer token string. Returns the matching token if valid.
    pub fn validate_token(&mut self, bearer: &str) -> Option<&ApiToken> {
        let hash = hash_token(bearer);
        let now = now_epoch();

        // Find token by hash
        let token_id = self
            .tokens
            .iter()
            .find(|(_, t)| t.token_hash == hash && t.is_active)
            .map(|(id, _)| id.clone())?;

        let token = self.tokens.get_mut(&token_id)?;

        // Check expiration
        if let Some(exp) = token.expires_at {
            if now > exp {
                return None;
            }
        }

        // Update usage stats
        token.last_used_at = Some(now);
        token.request_count += 1;

        self.tokens.get(&token_id)
    }

    /// Check if a token has a specific permission.
    pub fn has_permission(token: &ApiToken, perm: &Permission) -> bool {
        token.permissions.contains(perm)
    }
}

// ── Helpers ───────────────────────────────────────────────────────────

fn hash_token(plaintext: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(plaintext.as_bytes());
    hex::encode(hasher.finalize())
}

fn now_epoch() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn generate_token() -> String {
    // Generate a secure-looking token: hb-{uuid without dashes}
    format!("hb-{}", Uuid::new_v4().to_string().replace('-', ""))
}

// ── Persistence ───────────────────────────────────────────────────────

/// Load tokens from store.
pub async fn load_tokens(app: &AppHandle, manager: &ManagedAuthManager) -> Result<(), String> {
    let store = app
        .store("auth.json")
        .map_err(|e| format!("Failed to open auth store: {e}"))?;

    let mut mgr = manager.lock().await;

    if let Some(tokens_value) = store.get("tokens") {
        if let Ok(tokens) = serde_json::from_value::<Vec<ApiToken>>(tokens_value.clone()) {
            for token in tokens {
                mgr.tokens.insert(token.id.clone(), token);
            }
        }
    }

    if let Some(config_value) = store.get("authConfig") {
        if let Ok(config) = serde_json::from_value::<AuthConfig>(config_value.clone()) {
            mgr.config = config;
        }
    }

    Ok(())
}

/// Save tokens to store.
pub async fn save_tokens(app: &AppHandle, manager: &ManagedAuthManager) -> Result<(), String> {
    let store = app
        .store("auth.json")
        .map_err(|e| format!("Failed to open auth store: {e}"))?;

    let mgr = manager.lock().await;
    let tokens: Vec<&ApiToken> = mgr.tokens.values().collect();
    store.set("tokens", serde_json::to_value(&tokens).unwrap());
    store.set("authConfig", serde_json::to_value(&mgr.config).unwrap());
    store.save().map_err(|e| format!("Failed to save auth store: {e}"))?;

    Ok(())
}

// ── Tauri Commands ────────────────────────────────────────────────────

/// Create a new API token. Returns the plaintext ONCE.
#[tauri::command]
pub async fn auth_create_token(
    app: AppHandle,
    state: tauri::State<'_, ManagedAuthManager>,
    name: String,
    permissions: Vec<Permission>,
    expires_in_days: Option<u64>,
) -> Result<TokenCreateResult, String> {
    let plaintext = generate_token();
    let hash = hash_token(&plaintext);
    let now = now_epoch();
    let prefix = plaintext.chars().take(11).collect::<String>(); // "hb-" + 8 chars

    let token = ApiToken {
        id: Uuid::new_v4().to_string(),
        name,
        token_hash: hash,
        token_prefix: format!("{prefix}..."),
        permissions,
        created_at: now,
        last_used_at: None,
        expires_at: expires_in_days.map(|d| now + d * 86400),
        request_count: 0,
        is_active: true,
    };

    {
        let mut mgr = state.lock().await;
        mgr.tokens.insert(token.id.clone(), token.clone());
    }

    save_tokens(&app, state.inner()).await?;

    Ok(TokenCreateResult { token, plaintext })
}

/// List all tokens (without hashes, for display).
#[tauri::command]
pub async fn auth_list_tokens(
    state: tauri::State<'_, ManagedAuthManager>,
) -> Result<Vec<ApiToken>, String> {
    let mgr = state.lock().await;
    Ok(mgr.tokens.values().cloned().collect())
}

/// Revoke a token by ID.
#[tauri::command]
pub async fn auth_revoke_token(
    app: AppHandle,
    state: tauri::State<'_, ManagedAuthManager>,
    token_id: String,
) -> Result<(), String> {
    {
        let mut mgr = state.lock().await;
        if let Some(token) = mgr.tokens.get_mut(&token_id) {
            token.is_active = false;
        } else {
            return Err("Token not found".into());
        }
    }
    save_tokens(&app, state.inner()).await?;
    Ok(())
}

/// Delete a token permanently.
#[tauri::command]
pub async fn auth_delete_token(
    app: AppHandle,
    state: tauri::State<'_, ManagedAuthManager>,
    token_id: String,
) -> Result<(), String> {
    {
        let mut mgr = state.lock().await;
        mgr.tokens
            .remove(&token_id)
            .ok_or("Token not found")?;
    }
    save_tokens(&app, state.inner()).await?;
    Ok(())
}

/// Get auth config.
#[tauri::command]
pub async fn auth_get_config(
    state: tauri::State<'_, ManagedAuthManager>,
) -> Result<AuthConfig, String> {
    let mgr = state.lock().await;
    Ok(mgr.config.clone())
}

/// Update auth config (e.g., toggle "Require Auth").
#[tauri::command]
pub async fn auth_set_config(
    app: AppHandle,
    state: tauri::State<'_, ManagedAuthManager>,
    config: AuthConfig,
) -> Result<(), String> {
    {
        let mut mgr = state.lock().await;
        mgr.config = config;
    }
    save_tokens(&app, state.inner()).await?;
    Ok(())
}

// ── Public API for api_server.rs ──────────────────────────────────────

/// Validate a Bearer token from an HTTP request header.
/// Returns Ok(Some(token)) if valid, Ok(None) if auth not required, Err if auth fails.
pub async fn check_auth(
    auth_mgr: &ManagedAuthManager,
    auth_header: Option<&str>,
    required_permission: Option<&Permission>,
) -> Result<Option<ApiToken>, (u16, String)> {
    let mut mgr = auth_mgr.lock().await;

    if !mgr.config.auth_required {
        return Ok(None); // Auth disabled — allow all
    }

    let bearer = auth_header
        .and_then(|h| h.strip_prefix("Bearer "))
        .ok_or((401, "Missing or invalid Authorization header".to_string()))?;

    let token = mgr
        .validate_token(bearer)
        .cloned()
        .ok_or((401, "Invalid or expired token".to_string()))?;

    if let Some(perm) = required_permission {
        if !AuthManager::has_permission(&token, perm) {
            return Err((
                403,
                format!("Token lacks required permission: {:?}", perm),
            ));
        }
    }

    Ok(Some(token))
}
