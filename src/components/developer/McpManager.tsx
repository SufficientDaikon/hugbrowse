import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface McpToolDef {
  name: string;
  description: string;
  inputSchema: unknown;
}

interface McpServerStatus {
  name: string;
  transport: string;
  status: string;
  tools: McpToolDef[];
  lastError: string | null;
}

interface McpServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  allowedTools?: string[];
}

export function McpManager() {
  const [servers, setServers] = useState<McpServerStatus[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);

  const fetchServers = async () => {
    try {
      const list = await invoke<McpServerStatus[]>("mcp_list_servers");
      setServers(list ?? []);
    } catch (e) {
      console.error("Failed to fetch MCP servers:", e);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  const handleAdd = async () => {
    if (!newName.trim() || !newUrl.trim()) return;
    try {
      const config: McpServerConfig = { url: newUrl };
      await invoke("mcp_add_server", { name: newName, config });
      setShowAdd(false);
      setNewName("");
      setNewUrl("");
      await fetchServers();
    } catch (e) {
      console.error("Failed to add MCP server:", e);
    }
  };

  const handleRemove = async (name: string) => {
    try {
      await invoke("mcp_remove_server", { name });
      await fetchServers();
    } catch (e) {
      console.error("Failed to remove MCP server:", e);
    }
  };

  const handleConnect = async (name: string) => {
    setConnecting(name);
    try {
      await invoke("mcp_connect_server", { name });
      await fetchServers();
    } catch (e) {
      console.error("Failed to connect MCP server:", e);
      await fetchServers();
    } finally {
      setConnecting(null);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "bg-green-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-400";
    }
  };

  return (
    <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">MCP Servers</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-3 py-1.5 text-sm rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
        >
          {showAdd ? "Cancel" : "Add Server"}
        </button>
      </div>

      {showAdd && (
        <div className="space-y-3 p-4 rounded-lg bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--text-secondary)]">
              Server Name
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--input-bg)] border border-[var(--border-subtle)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="my-mcp-server"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--text-secondary)]">
              Server URL
            </label>
            <input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--input-bg)] border border-[var(--border-subtle)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="https://example.com/mcp"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={!newName.trim() || !newUrl.trim()}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            Add Server
          </button>
        </div>
      )}

      {(servers ?? []).length === 0 && !showAdd && (
        <div className="text-sm text-[var(--text-secondary)] text-center py-6">
          No MCP servers configured. Add one to enable tool calling.
        </div>
      )}

      <div className="space-y-2">
        {(servers ?? []).map((server: McpServerStatus) => (
          <div
            key={server.name}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] overflow-hidden"
          >
            <div
              className="flex items-center gap-3 p-3 cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
              onClick={() =>
                setExpanded(expanded === server.name ? null : server.name)
              }
            >
              <div
                className={`w-2 h-2 rounded-full ${statusColor(server.status)}`}
              />
              <div className="flex-1 min-w-0">
                <span className="font-medium text-sm">{server.name}</span>
                <span className="ml-2 text-xs text-[var(--text-secondary)]">
                  {server.transport || "http"} · {server.tools.length} tools
                </span>
              </div>
              <div className="flex items-center gap-2">
                {server.status !== "connected" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleConnect(server.name);
                    }}
                    disabled={connecting === server.name}
                    className="text-xs px-2 py-1 rounded bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {connecting === server.name ? "Connecting..." : "Connect"}
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(server.name);
                  }}
                  className="text-xs px-2 py-1 rounded text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>

            {expanded === server.name && (
              <div className="px-3 pb-3 border-t border-[var(--border-subtle)] space-y-2">
                {server.lastError && (
                  <div className="mt-2 text-xs text-red-400 p-2 rounded bg-red-500/5">
                    Error: {server.lastError}
                  </div>
                )}
                {server.tools.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <span className="text-xs font-medium text-[var(--text-secondary)]">
                      Available Tools:
                    </span>
                    {server.tools.map((tool: McpToolDef) => (
                      <div
                        key={tool.name}
                        className="text-xs p-2 rounded bg-[var(--input-bg)]"
                      >
                        <span className="font-mono font-medium">
                          {tool.name}
                        </span>
                        {tool.description && (
                          <span className="text-[var(--text-secondary)] ml-2">
                            — {tool.description}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {server.tools.length === 0 && !server.lastError && (
                  <div className="mt-2 text-xs text-[var(--text-secondary)]">
                    No tools discovered. Connect to discover available tools.
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
