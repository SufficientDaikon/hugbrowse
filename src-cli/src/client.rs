use serde::{Deserialize, Serialize};

pub struct HbClient {
    base_url: String,
    http: reqwest::Client,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ModelInfo {
    pub id: String,
    pub object: String,
    pub owned_by: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ModelsResponse {
    pub data: Vec<ModelInfo>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ChatCompletionResponse {
    pub id: String,
    pub choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ChatChoice {
    pub index: u32,
    pub message: ChatResponseMessage,
    pub finish_reason: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ChatResponseMessage {
    pub role: String,
    pub content: String,
}

impl HbClient {
    pub fn new(base_url: &str) -> Self {
        Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            http: reqwest::Client::new(),
        }
    }

    /// GET /v1/models
    pub async fn list_models(&self) -> Result<Vec<ModelInfo>, String> {
        let url = format!("{}/v1/models", self.base_url);
        let resp = self.http.get(&url).send().await
            .map_err(|e| format!("Connection failed: {}. Is the HugBrowse API server running?", e))?;

        if !resp.status().is_success() {
            return Err(format!("Server returned {}", resp.status()));
        }

        let body: ModelsResponse = resp.json().await
            .map_err(|e| format!("Parse error: {}", e))?;
        Ok(body.data)
    }

    /// GET /api/v1/status
    pub async fn get_status(&self) -> Result<serde_json::Value, String> {
        let url = format!("{}/api/v1/status", self.base_url);
        let resp = self.http.get(&url).send().await
            .map_err(|e| format!("Connection failed: {}. Is the HugBrowse API server running?", e))?;

        if !resp.status().is_success() {
            return Err(format!("Server returned {}", resp.status()));
        }

        resp.json().await
            .map_err(|e| format!("Parse error: {}", e))
    }

    /// POST /v1/chat/completions
    pub async fn chat_completion(
        &self,
        model: &str,
        messages: &[super::ChatMessage],
    ) -> Result<ChatCompletionResponse, String> {
        let url = format!("{}/v1/chat/completions", self.base_url);
        let body = serde_json::json!({
            "model": model,
            "messages": messages,
            "stream": false,
        });

        let resp = self.http.post(&url)
            .json(&body)
            .send().await
            .map_err(|e| format!("Connection failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("Server returned {}: {}", status, text));
        }

        resp.json().await
            .map_err(|e| format!("Parse error: {}", e))
    }

    /// POST /api/v1/models/load
    pub async fn load_model(&self, model: &str, context_length: u32) -> Result<serde_json::Value, String> {
        let url = format!("{}/api/v1/models/load", self.base_url);
        let body = serde_json::json!({
            "model": model,
            "contextLength": context_length,
        });

        let resp = self.http.post(&url)
            .json(&body)
            .send().await
            .map_err(|e| format!("Connection failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("Server returned {}: {}", status, text));
        }

        resp.json().await
            .map_err(|e| format!("Parse error: {}", e))
    }

    /// POST /api/v1/models/unload
    pub async fn unload_model(&self, model: &str) -> Result<serde_json::Value, String> {
        let url = format!("{}/api/v1/models/unload", self.base_url);
        let body = serde_json::json!({
            "model": model,
        });

        let resp = self.http.post(&url)
            .json(&body)
            .send().await
            .map_err(|e| format!("Connection failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("Server returned {}: {}", status, text));
        }

        resp.json().await
            .map_err(|e| format!("Parse error: {}", e))
    }
}
