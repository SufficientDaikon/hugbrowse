# HugBrowse MCP Server

An MCP (Model Context Protocol) server that exposes HugBrowse functionality to AI agents. Search Hugging Face, download models, load them for inference, and chat — all through structured tool calls.

## Quick Start

```bash
cd mcp-server
npm install
npm run build
```

## Configuration

### For GitHub Copilot CLI / Claude Code

Add to your MCP config (`~/.copilot/config.json` or `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "hugbrowse": {
      "command": "node",
      "args": ["h:/Hugging pc/hugbrowse/mcp-server/dist/index.js"],
      "env": {
        "HUGBROWSE_API_URL": "http://127.0.0.1:8080",
        "HF_TOKEN": "hf_your_token_here"
      }
    }
  }
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HUGBROWSE_API_URL` | `http://127.0.0.1:8080` | HugBrowse API server URL |
| `HUGBROWSE_API_KEY` | *(empty)* | API key if auth is enabled |
| `HF_TOKEN` | *(empty)* | Hugging Face token for private models |

## Prerequisites

1. **HugBrowse app running** — Launch the desktop app
2. **API server started** — Go to Developer tab → Start Server (port 8080)
3. **Model loaded** (for chat) — Download and load a GGUF model

## Available Tools (12)

### Browsing & Discovery
| Tool | Description |
|------|-------------|
| `hugbrowse_search_models` | Search Hugging Face Hub with filters |
| `hugbrowse_get_model_detail` | Get full metadata for a model |
| `hugbrowse_list_model_files` | List files in a model repo |
| `hugbrowse_get_readme` | Fetch model README/card |
| `hugbrowse_find_gguf_models` | Search specifically for downloadable GGUF models |

### Inference Engine
| Tool | Description |
|------|-------------|
| `hugbrowse_load_model` | Load a GGUF model for inference |
| `hugbrowse_unload_model` | Unload a model instance |
| `hugbrowse_list_loaded_models` | List all loaded model instances |

### Chat
| Tool | Description |
|------|-------------|
| `hugbrowse_chat` | Send a single message and get a response |
| `hugbrowse_multi_turn_chat` | Send full conversation history |

### System
| Tool | Description |
|------|-------------|
| `hugbrowse_server_status` | Check API server status |
| `hugbrowse_health_check` | Full system diagnostic |

## Example Agent Workflow

```
Agent: "Find a small LLM I can run locally"

1. hugbrowse_find_gguf_models(query="phi 3 mini", limit=3)
   → Returns: bartowski/Phi-3-mini-4k-instruct-GGUF with Q4_K_M (2.4 GB)

2. hugbrowse_health_check()
   → Returns: API server online, 0 models loaded

3. hugbrowse_load_model(
     model_path="C:/Users/.../Phi-3-mini-4k-instruct-Q4_K_M.gguf",
     model_name="Phi 3 Mini"
   )
   → Returns: ✅ Model loaded on port 11435

4. hugbrowse_chat(message="What is the capital of France?")
   → Returns: "The capital of France is Paris..."
```

## Development

```bash
npm run dev     # Watch mode with tsx
npm run build   # Compile TypeScript
npm start       # Run compiled server
```

## Architecture

```
AI Agent (Copilot/Claude)
    ↕ MCP (stdio)
HugBrowse MCP Server
    ↕ HTTP
┌──────────────────────┐
│ HugBrowse App        │
│  ├ API Server :8080  │  ← axum embedded server
│  ├ Model Manager     │  ← multi-instance llama-server
│  └ Auth Manager      │  ← token auth
└──────────────────────┘
    ↕ HTTP
HuggingFace API
```
