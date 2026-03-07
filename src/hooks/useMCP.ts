import { useState, useEffect } from "react";
import { mcpClient } from "../lib/mcp-client";
import { useSettings } from "../stores/settings";

type MCPStatus = "disconnected" | "connecting" | "connected" | "error";

export function useMCP() {
  const { hfToken } = useSettings();
  const [status, setStatus] = useState<MCPStatus>(mcpClient.getStatus());
  const [tools, setTools] = useState(mcpClient.getTools());

  useEffect(() => {
    const unsub = mcpClient.onStatusChange((newStatus) => {
      setStatus(newStatus);
      setTools(mcpClient.getTools());
    });
    return () => { unsub(); };
  }, []);

  useEffect(() => {
    mcpClient.setToken(hfToken);
    if (hfToken) {
      mcpClient.connect();
    } else {
      mcpClient.disconnect();
    }
  }, [hfToken]);

  return {
    status,
    tools,
    isConnected: status === "connected",
    callTool: mcpClient.callTool.bind(mcpClient),
    reconnect: () => mcpClient.connect(),
  };
}
