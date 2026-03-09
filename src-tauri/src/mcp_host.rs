use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::State;

pub type ManagedMcpHost = Arc<tokio::sync::Mutex<McpHost>>;

// ─── MCP Configuration (Omega Spec §9.2) ────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpConfig {
    #[serde(default)]
    pub servers: HashMap<String, McpServerConfig>,
}

impl Default for McpConfig {
    fn default() -> Self {
        Self {
            servers: HashMap::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServerConfig {
    // stdio transport
    pub command: Option<String>,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    // HTTP/SSE transport
    pub url: Option<String>,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    #[serde(default)]
    pub allowed_tools: Vec<String>,
}

// ─── MCP Runtime Types ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServerStatus {
    pub name: String,
    pub transport: String,
    pub status: String, // "connected", "disconnected", "error"
    pub tools: Vec<McpToolDef>,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpToolDef {
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub input_schema: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpToolCallRequest {
    pub server_name: String,
    pub tool_name: String,
    pub arguments: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpToolResult {
    pub content: Vec<McpContent>,
    #[serde(default)]
    pub is_error: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpContent {
    #[serde(rename = "type")]
    pub content_type: String,
    #[serde(default)]
    pub text: Option<String>,
}

// ─── JSON-RPC 2.0 ──────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct JsonRpcRequest {
    jsonrpc: String,
    id: u64,
    method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    params: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct JsonRpcResponse {
    #[allow(dead_code)]
    jsonrpc: String,
    #[allow(dead_code)]
    id: Option<u64>,
    result: Option<serde_json::Value>,
    error: Option<JsonRpcError>,
}

#[derive(Debug, Deserialize)]
struct JsonRpcError {
    #[allow(dead_code)]
    code: i64,
    message: String,
}

// ─── McpHost ────────────────────────────────────────────────────────────

pub struct McpHost {
    config: McpConfig,
    servers: HashMap<String, McpServerStatus>,
    config_path: std::path::PathBuf,
    request_id: u64,
    http_client: reqwest::Client,
    tool_timeout_secs: u64,
    approval_mode: bool,
}

impl McpHost {
    pub fn new() -> Self {
        Self {
            config: McpConfig::default(),
            servers: HashMap::new(),
            config_path: std::path::PathBuf::new(),
            request_id: 0,
            http_client: reqwest::Client::new(),
            tool_timeout_secs: 30,
            approval_mode: false,
        }
    }

    pub fn init(&mut self, config_dir: std::path::PathBuf) {
        self.config_path = config_dir.join("mcp.json");
        self.load_config();
    }

    fn next_id(&mut self) -> u64 {
        self.request_id += 1;
        self.request_id
    }

    // ─── Config persistence ─────────────────────────────────────

    fn load_config(&mut self) {
        if self.config_path.exists() {
            if let Ok(data) = std::fs::read_to_string(&self.config_path) {
                if let Ok(config) = serde_json::from_str::<McpConfig>(&data) {
                    self.config = config;
                }
            }
        }
        // Sync server status entries
        for (name, _cfg) in &self.config.servers {
            self.servers.entry(name.clone()).or_insert_with(|| McpServerStatus {
                name: name.clone(),
                transport: String::new(),
                status: "disconnected".to_string(),
                tools: Vec::new(),
                last_error: None,
            });
        }
    }

    fn save_config(&self) -> Result<(), String> {
        if let Some(parent) = self.config_path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        let json = serde_json::to_string_pretty(&self.config)
            .map_err(|e| format!("Serialize error: {}", e))?;
        std::fs::write(&self.config_path, json)
            .map_err(|e| format!("Write error: {}", e))?;
        Ok(())
    }

    // ─── Server management ──────────────────────────────────────

    pub fn add_server(&mut self, name: String, config: McpServerConfig) -> Result<(), String> {
        let transport = if config.url.is_some() { "http" } else { "stdio" };
        self.config.servers.insert(name.clone(), config);
        self.servers.insert(name.clone(), McpServerStatus {
            name: name.clone(),
            transport: transport.to_string(),
            status: "disconnected".to_string(),
            tools: Vec::new(),
            last_error: None,
        });
        self.save_config()
    }

    pub fn remove_server(&mut self, name: &str) -> Result<(), String> {
        self.config.servers.remove(name);
        self.servers.remove(name);
        self.save_config()
    }

    pub fn list_servers(&self) -> Vec<McpServerStatus> {
        self.servers.values().cloned().collect()
    }

    // ─── Connect / discover tools ───────────────────────────────

    pub async fn connect_server(&mut self, name: &str) -> Result<Vec<McpToolDef>, String> {
        let config = self.config.servers.get(name)
            .ok_or_else(|| format!("Server not found: {}", name))?
            .clone();

        let url = config.url.as_ref()
            .ok_or_else(|| "Only HTTP/SSE transport is supported currently".to_string())?;

        // Send initialize request
        let init_id = self.next_id();
        let init_req = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: init_id,
            method: "initialize".to_string(),
            params: Some(serde_json::json!({
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {
                    "name": "HugBrowse",
                    "version": "1.0.0"
                }
            })),
        };

        let mut req_builder = self.http_client.post(url).json(&init_req);
        for (key, value) in &config.headers {
            req_builder = req_builder.header(key, value);
        }

        let resp = req_builder.send().await
            .map_err(|e| format!("Connection failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let err = format!("Server returned {}", status);
            if let Some(server) = self.servers.get_mut(name) {
                server.status = "error".to_string();
                server.last_error = Some(err.clone());
            }
            return Err(err);
        }

        // Fetch tools
        let tools_id = self.next_id();
        let tools_req = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: tools_id,
            method: "tools/list".to_string(),
            params: None,
        };

        let mut req_builder = self.http_client.post(url).json(&tools_req);
        for (key, value) in &config.headers {
            req_builder = req_builder.header(key, value);
        }

        let resp = req_builder.send().await
            .map_err(|e| format!("Tools request failed: {}", e))?;
        let body = resp.text().await
            .map_err(|e| format!("Read body failed: {}", e))?;

        let rpc_resp: JsonRpcResponse = serde_json::from_str(&body)
            .map_err(|e| format!("Parse response failed: {}", e))?;

        if let Some(err) = rpc_resp.error {
            let err_msg = err.message;
            if let Some(server) = self.servers.get_mut(name) {
                server.status = "error".to_string();
                server.last_error = Some(err_msg.clone());
            }
            return Err(err_msg);
        }

        let tools: Vec<McpToolDef> = if let Some(result) = rpc_resp.result {
            if let Some(tools_arr) = result.get("tools") {
                serde_json::from_value(tools_arr.clone()).unwrap_or_default()
            } else {
                Vec::new()
            }
        } else {
            Vec::new()
        };

        if let Some(server) = self.servers.get_mut(name) {
            server.status = "connected".to_string();
            server.tools = tools.clone();
            server.last_error = None;
            server.transport = "http".to_string();
        }

        Ok(tools)
    }

    // ─── Tool execution ─────────────────────────────────────────

    pub async fn call_tool(&mut self, server_name: &str, tool_name: &str, arguments: serde_json::Value) -> Result<McpToolResult, String> {
        let config = self.config.servers.get(server_name)
            .ok_or_else(|| format!("Server not found: {}", server_name))?
            .clone();

        let url = config.url.as_ref()
            .ok_or_else(|| "Only HTTP transport supported".to_string())?;

        // Check allowed tools filter
        if !config.allowed_tools.is_empty() && !config.allowed_tools.contains(&tool_name.to_string()) {
            return Err(format!("Tool '{}' not in allowed_tools for server '{}'", tool_name, server_name));
        }

        let call_id = self.next_id();
        let call_req = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: call_id,
            method: "tools/call".to_string(),
            params: Some(serde_json::json!({
                "name": tool_name,
                "arguments": arguments,
            })),
        };

        let mut req_builder = self.http_client.post(url).json(&call_req);
        for (key, value) in &config.headers {
            req_builder = req_builder.header(key, value);
        }

        let resp = tokio::time::timeout(
            std::time::Duration::from_secs(self.tool_timeout_secs),
            req_builder.send()
        ).await
            .map_err(|_| format!("Tool execution timed out after {}s", self.tool_timeout_secs))?
            .map_err(|e| format!("Tool call failed: {}", e))?;

        let body = resp.text().await
            .map_err(|e| format!("Read body failed: {}", e))?;

        let rpc_resp: JsonRpcResponse = serde_json::from_str(&body)
            .map_err(|e| format!("Parse response failed: {}", e))?;

        if let Some(err) = rpc_resp.error {
            return Ok(McpToolResult {
                content: vec![McpContent {
                    content_type: "text".to_string(),
                    text: Some(format!("Error: {}", err.message)),
                }],
                is_error: true,
            });
        }

        if let Some(result) = rpc_resp.result {
            let tool_result: McpToolResult = serde_json::from_value(result)
                .unwrap_or(McpToolResult {
                    content: vec![McpContent {
                        content_type: "text".to_string(),
                        text: Some("Empty result".to_string()),
                    }],
                    is_error: false,
                });
            Ok(tool_result)
        } else {
            Ok(McpToolResult {
                content: vec![McpContent {
                    content_type: "text".to_string(),
                    text: Some("No result returned".to_string()),
                }],
                is_error: false,
            })
        }
    }
}

// ─── Tauri Commands ─────────────────────────────────────────────────────

#[tauri::command]
pub async fn mcp_list_servers(
    state: State<'_, ManagedMcpHost>,
) -> Result<Vec<McpServerStatus>, String> {
    let host = state.lock().await;
    Ok(host.list_servers())
}

#[tauri::command]
pub async fn mcp_add_server(
    state: State<'_, ManagedMcpHost>,
    name: String,
    config: McpServerConfig,
) -> Result<(), String> {
    let mut host = state.lock().await;
    host.add_server(name, config)
}

#[tauri::command]
pub async fn mcp_remove_server(
    state: State<'_, ManagedMcpHost>,
    name: String,
) -> Result<(), String> {
    let mut host = state.lock().await;
    host.remove_server(&name)
}

#[tauri::command]
pub async fn mcp_connect_server(
    state: State<'_, ManagedMcpHost>,
    name: String,
) -> Result<Vec<McpToolDef>, String> {
    let mut host = state.lock().await;
    host.connect_server(&name).await
}

#[tauri::command]
pub async fn mcp_call_tool(
    state: State<'_, ManagedMcpHost>,
    server_name: String,
    tool_name: String,
    arguments: serde_json::Value,
) -> Result<McpToolResult, String> {
    let mut host = state.lock().await;
    host.call_tool(&server_name, &tool_name, arguments).await
}

#[tauri::command]
pub async fn mcp_get_config(
    state: State<'_, ManagedMcpHost>,
) -> Result<McpConfig, String> {
    let host = state.lock().await;
    Ok(host.config.clone())
}

#[tauri::command]
pub async fn mcp_set_approval_mode(
    state: State<'_, ManagedMcpHost>,
    enabled: bool,
) -> Result<(), String> {
    let mut host = state.lock().await;
    host.approval_mode = enabled;
    Ok(())
}

#[tauri::command]
pub async fn mcp_get_approval_mode(
    state: State<'_, ManagedMcpHost>,
) -> Result<bool, String> {
    let host = state.lock().await;
    Ok(host.approval_mode)
}
