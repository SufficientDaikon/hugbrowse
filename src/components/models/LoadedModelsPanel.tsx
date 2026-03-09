import { useEffect } from "react";
import { useModelManager } from "../../stores/modelManager";
import type { LoadedModel } from "../../stores/modelManager";
import {
  Cpu,
  Square,
  Loader2,
  CheckCircle,
  XCircle,
  HardDrive,
  Activity,
} from "lucide-react";

/** Displays all loaded model instances with status, memory, and unload controls. */
export function LoadedModelsPanel() {
  const { loadedModels, memoryInfo, refreshModels, refreshMemory, unloadModel, unloadAll, initListeners } =
    useModelManager();

  useEffect(() => {
    // Wrap in try-catch for environments where Tauri IPC isn't available (tests)
    try {
      refreshModels();
      refreshMemory();
      initListeners();
    } catch {
      // Silently fail in non-Tauri environments
    }
    const interval = setInterval(() => {
      try {
        refreshModels();
        refreshMemory();
      } catch {
        // Silently fail
      }
    }, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const models = loadedModels ?? [];
  const mem = memoryInfo ?? null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
        <Cpu className="h-4 w-4" />
        <h3 className="text-sm font-semibold">Loaded Models</h3>
        <span className="ml-auto text-xs text-[var(--muted)]">
          {models.length} instance{models.length !== 1 ? "s" : ""}
        </span>
        {models.length > 1 && (
          <button
            onClick={unloadAll}
            className="text-xs text-red-500 hover:text-red-600 transition-colors"
          >
            Unload All
          </button>
        )}
      </div>

      {/* Memory bar */}
      {mem && (
        <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--background)]">
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <HardDrive className="h-3 w-3" />
            <span>
              RAM: {mem.modelsRamMb}MB used by models /{" "}
              {(mem.availableRamMb / 1024).toFixed(1)}GB available
            </span>
          </div>
          {mem.modelsVramMb > 0 && (
            <div className="flex items-center gap-2 text-xs text-[var(--muted)] mt-1">
              <Activity className="h-3 w-3" />
              <span>VRAM: {mem.modelsVramMb}MB used by models</span>
            </div>
          )}
        </div>
      )}

      <div className="divide-y divide-[var(--border)]">
        {models.length === 0 ? (
          <p className="text-sm text-[var(--muted)] text-center py-6">
            No models loaded. Load a model from the inference panel or use the
            API.
          </p>
        ) : (
          models.map((model) => (
            <LoadedModelRow
              key={model.instanceId}
              model={model}
              onUnload={() => unloadModel(model.instanceId)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function LoadedModelRow({
  model,
  onUnload,
}: {
  model: LoadedModel;
  onUnload: () => void;
}) {
  const statusIcon = {
    loading: <Loader2 className="h-3.5 w-3.5 animate-spin text-yellow-500" />,
    ready: <CheckCircle className="h-3.5 w-3.5 text-green-500" />,
    error: <XCircle className="h-3.5 w-3.5 text-red-500" />,
    unloading: <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-500" />,
  }[model.status];

  return (
    <div className="px-4 py-3 flex items-center gap-3">
      {statusIcon}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{model.modelName}</p>
        <p className="text-xs text-[var(--muted)]">
          Port {model.port} · {model.contextLength.toLocaleString()} ctx ·{" "}
          {model.vramUsageMb}MB VRAM · TTL{" "}
          {model.ttlSeconds === 0 ? "∞" : `${model.ttlSeconds}s`}
          {model.loadSource === "jit" && (
            <span className="ml-1 text-blue-500">(JIT)</span>
          )}
        </p>
        {model.error && (
          <p className="text-xs text-red-500 mt-0.5">{model.error}</p>
        )}
      </div>
      <span className="text-xs text-[var(--muted)] tabular-nums">
        {model.requestCount} req
      </span>
      <button
        onClick={onUnload}
        disabled={model.status === "unloading"}
        className="flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
      >
        <Square className="h-3 w-3" />
        Unload
      </button>
    </div>
  );
}
