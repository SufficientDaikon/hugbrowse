/**
 * Lightweight MCP client for HuggingFace's MCP server.
 * Uses Server-Sent Events (SSE) transport.
 * This is an enrichment layer — REST API is primary.
 */

const MCP_SERVER_URL = "https://huggingface.co/mcp";

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPToolResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

type MCPStatus = "disconnected" | "connecting" | "connected" | "error";

class HuggingFaceMCPClient {
  private status: MCPStatus = "disconnected";
  private tools: MCPTool[] = [];
  private token: string | null = null;
  private listeners: Set<(status: MCPStatus) => void> = new Set();

  getStatus(): MCPStatus {
    return this.status;
  }

  getTools(): MCPTool[] {
    return this.tools;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  onStatusChange(fn: (status: MCPStatus) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private setStatus(status: MCPStatus) {
    this.status = status;
    this.listeners.forEach((fn) => fn(status));
  }

  /**
   * Attempt to connect and discover available tools.
   * MCP over SSE: POST to the server's message endpoint.
   */
  async connect(): Promise<boolean> {
    if (!this.token) {
      this.setStatus("disconnected");
      return false;
    }

    this.setStatus("connecting");

    try {
      // MCP uses JSON-RPC 2.0 over HTTP/SSE
      // First, initialize the session
      const initRes = await fetch(MCP_SERVER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "HugBrowse", version: "0.1.0" },
          },
        }),
      });

      if (!initRes.ok) {
        this.setStatus("error");
        return false;
      }

      // List available tools
      const toolsRes = await fetch(MCP_SERVER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
          params: {},
        }),
      });

      if (toolsRes.ok) {
        const data = await toolsRes.json();
        this.tools = data.result?.tools ?? [];
      }

      this.setStatus("connected");
      return true;
    } catch {
      this.setStatus("error");
      return false;
    }
  }

  async disconnect() {
    this.tools = [];
    this.setStatus("disconnected");
  }

  /**
   * Call an MCP tool by name with arguments.
   * EC-015: Defensive parsing for malformed JSON responses.
   * FR-042: 30-second timeout on tool calls.
   */
  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<MCPToolResult | null> {
    if (this.status !== "connected" || !this.token) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(MCP_SERVER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "tools/call",
          params: { name, arguments: args },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      if (!res.ok) return null;
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        if (data.error) {
          return {
            content: [
              {
                type: "text",
                text: `MCP error: ${data.error.message ?? JSON.stringify(data.error)}`,
              },
            ],
            isError: true,
          };
        }
        return data.result ?? null;
      } catch {
        // EC-015: Malformed JSON — surface error, don't crash
        return {
          content: [
            {
              type: "text",
              text: `MCP returned invalid JSON: ${text.slice(0, 200)}`,
            },
          ],
          isError: true,
        };
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        return {
          content: [
            { type: "text", text: `MCP tool "${name}" timed out after 30s` },
          ],
          isError: true,
        };
      }
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Convenience: search models via MCP if available.
   * Falls back gracefully — caller should prefer REST API.
   */
  async searchModels(query: string): Promise<unknown | null> {
    return this.callTool("search_models", { query, limit: 10 });
  }

  /**
   * Convenience: get model details via MCP if available.
   */
  async getModelInfo(modelId: string): Promise<unknown | null> {
    return this.callTool("get_model_info", { model_id: modelId });
  }
}

export const mcpClient = new HuggingFaceMCPClient();
