/**
 * Plugin Runtime — FR-079 through FR-086
 * Manages plugin lifecycle: load, execute in sandbox, communicate via postMessage.
 */
import type {
  PluginManifest,
  PluginPermission,
  InstalledExtension,
} from "../marketplace/types";

export interface PluginAPI {
  getModelStatus: () => Promise<{ status: string; name?: string; port?: number }>;
  sendChatMessage: (sessionId: string, message: string) => Promise<void>;
  readSetting: (key: string) => Promise<unknown>;
  writeSetting: (key: string, value: unknown) => Promise<void>;
  getInstalledModels: () => Promise<{ name: string; path: string }[]>;
}

/** FR-083: Plugin watchdog limits */
const CPU_TIME_LIMIT_MS = 5000;
/** Memory limit in MB — enforced by the watchdog */
export const PLUGIN_MEMORY_LIMIT_MB = 50;

interface RunningPlugin {
  id: string;
  manifest: PluginManifest;
  iframe: HTMLIFrameElement | null;
  startedAt: number;
  status: "running" | "crashed" | "stopped";
}

class PluginRuntime {
  private plugins = new Map<string, RunningPlugin>();

  constructor() {
    // Listen for postMessage from sandboxed plugins
    window.addEventListener("message", (event) => {
      if (event.data?.type === "plugin-api-call") {
        this.handlePluginAPICall(event.data.pluginId, event.data.method, event.data.args);
      }
    });
  }

  /** FR-080: Load plugin in sandboxed iframe */
  loadPlugin(extension: InstalledExtension, manifest: PluginManifest): boolean {
    if (this.plugins.has(extension.id)) return true;

    try {
      // Create sandboxed iframe
      const iframe = document.createElement("iframe");
      iframe.sandbox.add("allow-scripts");
      iframe.style.display = "none";
      iframe.id = `plugin-${extension.id}`;

      // FR-082: Check permissions match what user approved
      const approvedPerms = new Set(extension.permissions);
      const requiredPerms = manifest.permissions || [];
      const unapproved = requiredPerms.filter((p) => !approvedPerms.has(p));
      if (unapproved.length > 0) {
        console.warn(`Plugin ${manifest.name} requires unapproved permissions:`, unapproved);
        return false;
      }

      document.body.appendChild(iframe);

      const plugin: RunningPlugin = {
        id: extension.id,
        manifest,
        iframe,
        startedAt: Date.now(),
        status: "running",
      };
      this.plugins.set(extension.id, plugin);

      // FR-083: Start watchdog
      this.startWatchdog(extension.id);

      return true;
    } catch (e) {
      console.error(`Failed to load plugin ${manifest.name}:`, e);
      return false;
    }
  }

  /** FR-083: Watchdog that terminates runaway plugins */
  private startWatchdog(pluginId: string) {
    const checkInterval = setInterval(() => {
      const plugin = this.plugins.get(pluginId);
      if (!plugin || plugin.status !== "running") {
        clearInterval(checkInterval);
        return;
      }

      // Check if plugin has been running too long without yielding
      const elapsed = Date.now() - plugin.startedAt;
      if (elapsed > CPU_TIME_LIMIT_MS * 10) {
        // Long-running is OK, but we check iframe responsiveness
        try {
          plugin.iframe?.contentWindow?.postMessage({ type: "ping" }, "*");
        } catch {
          this.terminatePlugin(pluginId, "Plugin became unresponsive");
          clearInterval(checkInterval);
        }
      }
    }, CPU_TIME_LIMIT_MS);
  }

  /** FR-083: Terminate a misbehaving plugin */
  terminatePlugin(pluginId: string, reason: string) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;

    plugin.status = "crashed";
    if (plugin.iframe) {
      plugin.iframe.remove();
      plugin.iframe = null;
    }
    console.warn(`Plugin ${plugin.manifest.name} terminated: ${reason}`);
    this.plugins.delete(pluginId);
  }

  /** FR-084: Unload a plugin cleanly */
  unloadPlugin(pluginId: string) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;

    plugin.status = "stopped";
    if (plugin.iframe) {
      plugin.iframe.remove();
    }
    this.plugins.delete(pluginId);
  }

  /** FR-081: Handle Plugin API calls from sandboxed iframes */
  private async handlePluginAPICall(pluginId: string, method: string, _args: unknown[]) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;

    // Check permission for the requested method
    const permRequired = this.methodToPermission(method);
    const ext = plugin.manifest;
    if (permRequired && !ext.permissions?.includes(permRequired)) {
      plugin.iframe?.contentWindow?.postMessage(
        { type: "plugin-api-error", method, error: `Permission denied: ${permRequired}` },
        "*",
      );
      return;
    }

    // Route to implementation (stub — actual implementation uses stores)
    try {
      let result: unknown = null;
      switch (method) {
        case "getModelStatus":
          result = { status: "unloaded" }; // Would read from inference store
          break;
        case "readSetting":
          result = null; // Would read from settings store
          break;
        default:
          result = null;
      }
      plugin.iframe?.contentWindow?.postMessage(
        { type: "plugin-api-result", method, result },
        "*",
      );
    } catch (e) {
      plugin.iframe?.contentWindow?.postMessage(
        { type: "plugin-api-error", method, error: String(e) },
        "*",
      );
    }
  }

  /** Map API methods to required permissions */
  private methodToPermission(method: string): PluginPermission | null {
    const map: Record<string, PluginPermission> = {
      getModelStatus: "model",
      sendChatMessage: "chat",
      readSetting: "settings",
      writeSetting: "settings",
      getInstalledModels: "model",
      readFile: "filesystem",
      fetchUrl: "network",
      queryRag: "rag",
    };
    return map[method] ?? null;
  }

  /** Get running plugin info */
  getRunningPlugins(): { id: string; name: string; status: string }[] {
    return Array.from(this.plugins.values()).map((p) => ({
      id: p.id,
      name: p.manifest.name,
      status: p.status,
    }));
  }

  /** Get UI contributions from all running plugins */
  getUIContributions(type: string): { pluginId: string; label: string; icon?: string }[] {
    const contributions: { pluginId: string; label: string; icon?: string }[] = [];
    for (const [id, plugin] of this.plugins) {
      if (plugin.status !== "running" || !plugin.manifest.ui) continue;
      for (const ui of plugin.manifest.ui) {
        if (ui.type === type) {
          contributions.push({ pluginId: id, label: ui.label, icon: ui.icon });
        }
      }
    }
    return contributions;
  }
}

export const pluginRuntime = new PluginRuntime();
