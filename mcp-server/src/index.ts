#!/usr/bin/env node
/**
 * HugBrowse MCP Server
 *
 * Exposes HugBrowse desktop app functionality to AI agents via MCP.
 * Supports searching HuggingFace, downloading models, loading them for
 * inference, and chatting — all through structured tool calls.
 *
 * Transport: stdio (default) or streamable HTTP (set TRANSPORT=http)
 * Requires: HugBrowse API server running (start with the app's Developer tab)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  apiGetStatus,
  apiListModels,
  apiLoadModel,
  apiUnloadModel,
  apiChat,
  hfSearchModels,
  hfGetModelDetail,
  hfGetModelFiles,
  hfGetModelReadme,
  type ChatMessage,
} from "./client.js";

// ── Constants ────────────────────────────────────────────────────────

const CHARACTER_LIMIT = 25_000;

function truncate(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return text.slice(0, CHARACTER_LIMIT) + "\n\n... (truncated)";
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function handleError(error: unknown): { content: Array<{ type: "text"; text: string }>; isError: true } {
  const msg = error instanceof Error ? error.message : String(error);
  return { isError: true, content: [{ type: "text", text: `Error: ${msg}` }] };
}

// ── Server ───────────────────────────────────────────────────────────

const server = new McpServer({
  name: "hugbrowse-mcp-server",
  version: "1.0.0",
});

// =====================================================================
// TOOL 1: hugbrowse_search_models
// =====================================================================

server.registerTool(
  "hugbrowse_search_models",
  {
    title: "Search Hugging Face Models",
    description: `Search the Hugging Face Hub for models. Supports text queries, tag filters (e.g. "gguf", "text-generation"), and sorting.

Returns a list of models with their ID, author, tags, download count, and likes.

Args:
  - query: Text search (e.g. "llama 3 gguf", "mistral")
  - filter: Tag filter (e.g. "gguf", "text-generation", "text-generation,gguf")
  - sort: Sort field ("downloads", "likes", "lastModified", "trending")
  - limit: Max results 1-50 (default 10)

Examples:
  - Search GGUF models: query="llama", filter="gguf"
  - Trending models: sort="trending", limit=10
  - Text generation: filter="text-generation"`,
    inputSchema: {
      query: z.string().default("").describe("Search text (model name, author, description)"),
      filter: z.string().optional().describe('Tag filter, e.g. "gguf", "text-generation"'),
      sort: z.enum(["downloads", "likes", "lastModified", "trending"]).default("downloads").describe("Sort field"),
      limit: z.number().int().min(1).max(50).default(10).describe("Max results to return"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async ({ query, filter, sort, limit }) => {
    try {
      const models = await hfSearchModels(query, filter, sort, limit);
      if (models.length === 0) {
        return { content: [{ type: "text", text: `No models found for query="${query}" filter="${filter ?? ""}"` }] };
      }
      const lines = [`# Search Results (${models.length} models)\n`];
      for (const m of models) {
        const tags = m.tags?.slice(0, 5).join(", ") ?? "";
        lines.push(`## ${m.id}`);
        lines.push(`- **Downloads**: ${m.downloads.toLocaleString()} | **Likes**: ${m.likes}`);
        lines.push(`- **Pipeline**: ${m.pipeline_tag ?? "N/A"} | **Library**: ${m.library_name ?? "N/A"}`);
        if (tags) lines.push(`- **Tags**: ${tags}`);
        lines.push("");
      }
      return { content: [{ type: "text", text: truncate(lines.join("\n")) }] };
    } catch (e) {
      return handleError(e);
    }
  },
);

// =====================================================================
// TOOL 2: hugbrowse_get_model_detail
// =====================================================================

server.registerTool(
  "hugbrowse_get_model_detail",
  {
    title: "Get Model Details",
    description: `Get detailed information about a specific Hugging Face model by its full ID (e.g. "TheBloke/Llama-2-7B-GGUF").

Returns metadata, parameter count, tags, download stats, and available files.

Args:
  - model_id: Full model ID in "author/name" format`,
    inputSchema: {
      model_id: z.string().min(1).describe('Full model ID, e.g. "TheBloke/Llama-2-7B-GGUF"'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async ({ model_id }) => {
    try {
      const m = await hfGetModelDetail(model_id);
      const lines = [
        `# ${m.id}`,
        "",
        `| Field | Value |`,
        `|-------|-------|`,
        `| Author | ${m.author ?? "N/A"} |`,
        `| Pipeline | ${m.pipeline_tag ?? "N/A"} |`,
        `| Library | ${m.library_name ?? "N/A"} |`,
        `| Downloads | ${m.downloads?.toLocaleString() ?? 0} |`,
        `| Likes | ${m.likes ?? 0} |`,
        `| Last Modified | ${m.lastModified ?? "N/A"} |`,
        `| Private | ${m.private ? "Yes" : "No"} |`,
        "",
      ];
      if (m.tags?.length) {
        lines.push(`**Tags**: ${m.tags.join(", ")}`, "");
      }
      if (m.safetensors?.total) {
        lines.push(`**Parameters**: ${(m.safetensors.total / 1e9).toFixed(1)}B`, "");
      }
      if (m.siblings?.length) {
        const ggufFiles = m.siblings.filter(f => (f.rfilename ?? f.path ?? "").endsWith(".gguf"));
        if (ggufFiles.length) {
          lines.push(`## GGUF Files (${ggufFiles.length})`, "");
          for (const f of ggufFiles) {
            const name = f.path ?? f.rfilename ?? "?";
            const size = f.lfs?.size ?? f.size ?? 0;
            lines.push(`- \`${name}\` — ${formatBytes(size)}`);
          }
          lines.push("");
        }
      }
      return { content: [{ type: "text", text: truncate(lines.join("\n")) }] };
    } catch (e) {
      return handleError(e);
    }
  },
);

// =====================================================================
// TOOL 3: hugbrowse_list_model_files
// =====================================================================

server.registerTool(
  "hugbrowse_list_model_files",
  {
    title: "List Model Files",
    description: `List all files in a Hugging Face model repository.

Shows file names, sizes, and identifies GGUF files suitable for local inference.

Args:
  - model_id: Full model ID (e.g. "bartowski/Llama-3-8B-GGUF")
  - gguf_only: If true, only show GGUF files (default: false)`,
    inputSchema: {
      model_id: z.string().min(1).describe("Full model ID"),
      gguf_only: z.boolean().default(false).describe("Only show GGUF files"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async ({ model_id, gguf_only }) => {
    try {
      let files = await hfGetModelFiles(model_id);
      if (gguf_only) {
        files = files.filter(f => (f.path ?? f.rfilename ?? "").toLowerCase().endsWith(".gguf"));
      }
      if (files.length === 0) {
        return { content: [{ type: "text", text: gguf_only ? `No GGUF files found in ${model_id}` : `No files in ${model_id}` }] };
      }
      const lines = [`# Files in ${model_id} (${files.length})\n`, "| File | Size |", "|------|------|"];
      for (const f of files) {
        const name = f.path ?? f.rfilename ?? "?";
        const size = f.lfs?.size ?? f.size ?? 0;
        lines.push(`| \`${name}\` | ${formatBytes(size)} |`);
      }
      return { content: [{ type: "text", text: truncate(lines.join("\n")) }] };
    } catch (e) {
      return handleError(e);
    }
  },
);

// =====================================================================
// TOOL 4: hugbrowse_get_readme
// =====================================================================

server.registerTool(
  "hugbrowse_get_readme",
  {
    title: "Get Model README",
    description: `Fetch the README/model card for a Hugging Face model. Useful for understanding model capabilities, usage instructions, and licensing.

Args:
  - model_id: Full model ID`,
    inputSchema: {
      model_id: z.string().min(1).describe("Full model ID"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async ({ model_id }) => {
    try {
      const readme = await hfGetModelReadme(model_id);
      return { content: [{ type: "text", text: truncate(readme) }] };
    } catch (e) {
      return handleError(e);
    }
  },
);

// =====================================================================
// TOOL 5: hugbrowse_server_status
// =====================================================================

server.registerTool(
  "hugbrowse_server_status",
  {
    title: "Get HugBrowse Server Status",
    description: `Check if the HugBrowse API server is running and get its current status.

Returns server configuration, loaded models count, and health info. The API server must be started from HugBrowse's Developer tab first.

No parameters required.`,
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async () => {
    try {
      const status = await apiGetStatus();
      return { content: [{ type: "text", text: `# HugBrowse API Server Status\n\n\`\`\`json\n${JSON.stringify(status, null, 2)}\n\`\`\`` }] };
    } catch (e) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: `Error: Cannot reach HugBrowse API server. Make sure:\n1. HugBrowse app is running\n2. API server is started (Developer tab → Start Server)\n3. Server is on ${process.env.HUGBROWSE_API_URL ?? "http://127.0.0.1:8080"}\n\nRaw error: ${e instanceof Error ? e.message : String(e)}`,
        }],
      };
    }
  },
);

// =====================================================================
// TOOL 6: hugbrowse_list_loaded_models
// =====================================================================

server.registerTool(
  "hugbrowse_list_loaded_models",
  {
    title: "List Loaded Models",
    description: `List all models currently loaded in HugBrowse's inference engine.

Returns model IDs, names, ports, status, and resource usage for each loaded instance.

Requires the HugBrowse API server to be running.`,
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async () => {
    try {
      const result = await apiListModels();
      const models = result.data ?? [];
      if (models.length === 0) {
        return { content: [{ type: "text", text: "No models currently loaded. Use `hugbrowse_load_model` to load one." }] };
      }
      const lines = [`# Loaded Models (${models.length})\n`];
      for (const m of models) {
        lines.push(`- **${m.id}** (${m.owned_by})`);
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    } catch (e) {
      return handleError(e);
    }
  },
);

// =====================================================================
// TOOL 7: hugbrowse_load_model
// =====================================================================

server.registerTool(
  "hugbrowse_load_model",
  {
    title: "Load Model for Inference",
    description: `Load a GGUF model file into HugBrowse's inference engine (llama-server sidecar).

The model must already be downloaded to the local filesystem. Once loaded, you can chat with it.

Args:
  - model_path: Absolute path to the .gguf file on disk
  - model_name: Human-readable name for the model
  - ctx_size: Context window in tokens (default: 4096)
  - n_gpu_layers: GPU layers to offload (-1 = all, 0 = CPU only, default: -1)
  - port: Port for llama-server (default: auto-assigned)

Example: model_path="C:/Users/user/models/llama-3-8b-q4.gguf", model_name="Llama 3 8B Q4"`,
    inputSchema: {
      model_path: z.string().min(1).describe("Absolute path to the .gguf file"),
      model_name: z.string().min(1).describe("Display name for this model"),
      ctx_size: z.number().int().min(512).max(131072).default(4096).describe("Context size in tokens"),
      n_gpu_layers: z.number().int().min(-1).max(999).default(-1).describe("GPU layers (-1 = all)"),
      port: z.number().int().min(1024).max(65535).optional().describe("Port for inference server"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async ({ model_path, model_name, ctx_size, n_gpu_layers, port }) => {
    try {
      const result = await apiLoadModel({
        model_path,
        model_name,
        ctx_size,
        n_gpu_layers,
        port,
      });
      return {
        content: [{
          type: "text",
          text: `✅ Model loaded successfully!\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n\nYou can now use \`hugbrowse_chat\` to send messages.`,
        }],
      };
    } catch (e) {
      return handleError(e);
    }
  },
);

// =====================================================================
// TOOL 8: hugbrowse_unload_model
// =====================================================================

server.registerTool(
  "hugbrowse_unload_model",
  {
    title: "Unload Model",
    description: `Unload a model instance from HugBrowse's inference engine, freeing RAM/VRAM.

Args:
  - instance_id: The model instance ID to unload (get from hugbrowse_list_loaded_models)`,
    inputSchema: {
      instance_id: z.string().min(1).describe("Model instance ID to unload"),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
  async ({ instance_id }) => {
    try {
      await apiUnloadModel(instance_id);
      return { content: [{ type: "text", text: `✅ Model instance \`${instance_id}\` unloaded successfully.` }] };
    } catch (e) {
      return handleError(e);
    }
  },
);

// =====================================================================
// TOOL 9: hugbrowse_chat
// =====================================================================

server.registerTool(
  "hugbrowse_chat",
  {
    title: "Chat with Loaded Model",
    description: `Send a chat message to a model loaded in HugBrowse and get a response.

Uses the OpenAI-compatible /v1/chat/completions endpoint. Requires a model to be loaded first.

Args:
  - message: The user message to send
  - system_prompt: Optional system prompt to set model behavior
  - model: Optional model ID (if multiple models loaded)
  - temperature: Sampling temperature 0.0-2.0 (default: 0.7)
  - max_tokens: Maximum response tokens (default: 2048)

Example: message="Explain quantum computing in simple terms"`,
    inputSchema: {
      message: z.string().min(1).describe("The message to send to the model"),
      system_prompt: z.string().optional().describe("System prompt for model behavior"),
      model: z.string().optional().describe("Model ID if multiple are loaded"),
      temperature: z.number().min(0).max(2).default(0.7).describe("Sampling temperature"),
      max_tokens: z.number().int().min(1).max(131072).default(2048).describe("Max response tokens"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async ({ message, system_prompt, model, temperature, max_tokens }) => {
    try {
      const messages: ChatMessage[] = [];
      if (system_prompt) messages.push({ role: "system", content: system_prompt });
      messages.push({ role: "user", content: message });

      const response = await apiChat({
        messages,
        model,
        temperature,
        max_tokens,
        stream: false,
      });

      const reply = response.choices?.[0]?.message?.content ?? "(empty response)";
      const usage = response.usage;
      const meta = usage
        ? `\n\n---\n*Tokens: ${usage.prompt_tokens} prompt + ${usage.completion_tokens} completion = ${usage.total_tokens} total*`
        : "";

      return { content: [{ type: "text", text: reply + meta }] };
    } catch (e) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: `Chat error: ${e instanceof Error ? e.message : String(e)}\n\nMake sure a model is loaded first with \`hugbrowse_load_model\`.`,
        }],
      };
    }
  },
);

// =====================================================================
// TOOL 10: hugbrowse_multi_turn_chat
// =====================================================================

server.registerTool(
  "hugbrowse_multi_turn_chat",
  {
    title: "Multi-turn Chat",
    description: `Send a full conversation history to the loaded model. Useful for multi-turn conversations where you maintain the message history.

Args:
  - messages: Array of {role, content} objects. Roles: "system", "user", "assistant"
  - model: Optional model ID
  - temperature: 0.0-2.0 (default: 0.7)
  - max_tokens: Max response tokens (default: 2048)`,
    inputSchema: {
      messages: z.array(z.object({
        role: z.enum(["system", "user", "assistant"]).describe("Message role"),
        content: z.string().describe("Message content"),
      })).min(1).describe("Conversation messages"),
      model: z.string().optional().describe("Model ID"),
      temperature: z.number().min(0).max(2).default(0.7).describe("Temperature"),
      max_tokens: z.number().int().min(1).max(131072).default(2048).describe("Max tokens"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async ({ messages, model, temperature, max_tokens }) => {
    try {
      const response = await apiChat({ messages, model, temperature, max_tokens, stream: false });
      const reply = response.choices?.[0]?.message?.content ?? "(empty response)";
      return { content: [{ type: "text", text: reply }] };
    } catch (e) {
      return handleError(e);
    }
  },
);

// =====================================================================
// TOOL 11: hugbrowse_find_gguf_models
// =====================================================================

server.registerTool(
  "hugbrowse_find_gguf_models",
  {
    title: "Find Downloadable GGUF Models",
    description: `Search specifically for GGUF-format models that can be downloaded and run locally with HugBrowse.

This is a convenience tool that searches HF with the "gguf" filter and shows available quantizations.

Args:
  - query: Search text (e.g. "llama 3", "mistral", "phi", "qwen")
  - limit: Max results 1-20 (default: 5)

Example: query="llama 3.1 8b" → finds GGUF repos with downloadable quant files`,
    inputSchema: {
      query: z.string().min(1).describe("Model search text"),
      limit: z.number().int().min(1).max(20).default(5).describe("Max results"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async ({ query, limit }) => {
    try {
      const models = await hfSearchModels(query, "gguf", "downloads", limit);
      if (models.length === 0) {
        return { content: [{ type: "text", text: `No GGUF models found for "${query}". Try a different search.` }] };
      }

      const lines = [`# GGUF Models for "${query}" (${models.length} results)\n`];

      for (const m of models) {
        lines.push(`## ${m.id}`);
        lines.push(`⬇ ${m.downloads.toLocaleString()} downloads | ❤ ${m.likes} likes`);
        // Fetch files to show available quants
        try {
          const files = await hfGetModelFiles(m.id);
          const ggufFiles = files.filter(f => (f.path ?? f.rfilename ?? "").toLowerCase().endsWith(".gguf"));
          if (ggufFiles.length > 0) {
            lines.push(`\n**Available files (${ggufFiles.length}):**`);
            for (const f of ggufFiles.slice(0, 8)) {
              const name = f.path ?? f.rfilename ?? "?";
              const size = f.lfs?.size ?? f.size ?? 0;
              lines.push(`- \`${name}\` (${formatBytes(size)})`);
            }
            if (ggufFiles.length > 8) lines.push(`- ... and ${ggufFiles.length - 8} more`);
          }
        } catch {
          lines.push("*(Could not fetch file list)*");
        }
        lines.push("");
      }

      lines.push("---");
      lines.push("💡 To download: Use the HugBrowse app's model browser, or download the .gguf file to your models directory, then use `hugbrowse_load_model` to load it.");

      return { content: [{ type: "text", text: truncate(lines.join("\n")) }] };
    } catch (e) {
      return handleError(e);
    }
  },
);

// =====================================================================
// TOOL 12: hugbrowse_health_check
// =====================================================================

server.registerTool(
  "hugbrowse_health_check",
  {
    title: "Full Health Check",
    description: `Run a comprehensive health check on the HugBrowse system.

Checks:
1. API server connectivity
2. Loaded models status
3. HuggingFace API accessibility

Returns a diagnostic report. No parameters needed.`,
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async () => {
    const checks: string[] = ["# HugBrowse Health Check\n"];

    // Check 1: API server
    try {
      const status = await apiGetStatus();
      checks.push("✅ **API Server**: Online");
      checks.push(`   - ${JSON.stringify(status)}`);
    } catch (e) {
      checks.push(`❌ **API Server**: Offline — ${e instanceof Error ? e.message : String(e)}`);
      checks.push("   → Start the API server from HugBrowse Developer tab");
    }

    // Check 2: Loaded models
    try {
      const models = await apiListModels();
      const count = models.data?.length ?? 0;
      checks.push(`${count > 0 ? "✅" : "⚠️"} **Loaded Models**: ${count} model(s)`);
      for (const m of (models.data ?? [])) {
        checks.push(`   - ${m.id}`);
      }
      if (count === 0) {
        checks.push("   → Load a model with `hugbrowse_load_model` to start chatting");
      }
    } catch {
      checks.push("⚠️ **Loaded Models**: Cannot check (API server may be off)");
    }

    // Check 3: HuggingFace API
    try {
      const test = await hfSearchModels("test", undefined, undefined, 1);
      checks.push(`✅ **HuggingFace API**: Accessible (found ${test.length} result)`);
    } catch (e) {
      checks.push(`❌ **HuggingFace API**: ${e instanceof Error ? e.message : String(e)}`);
    }

    checks.push("\n---\n*Run `hugbrowse_server_status` for detailed server config.*");

    return { content: [{ type: "text", text: checks.join("\n") }] };
  },
);

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("HugBrowse MCP server running via stdio — 12 tools available");
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
