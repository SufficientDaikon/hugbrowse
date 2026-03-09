import { useState } from "react";
import { useBackends } from "../../stores/backends";
import { AddBackendDialog } from "./AddBackendDialog";
import { invoke } from "@tauri-apps/api/core";
import {
  Server,
  Globe,
  Cpu,
  Circle,
  Plus,
  Trash2,
  Check,
  AlertTriangle,
  Key,
  Play,
  Pause,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { cn } from "../ui/cn";
import type { BackendStatus } from "../../stores/backends";

const TYPE_ICONS = {
  local_sidecar: Cpu,
  hf_endpoint: Globe,
  custom_url: Server,
} as const;

const TYPE_LABELS = {
  local_sidecar: "Local Sidecar",
  hf_endpoint: "Hugging Face Endpoint",
  custom_url: "Custom URL",
} as const;

function getStatusColor(status: BackendStatus): string {
  switch (status) {
    case "online":
      return "text-green-500";
    case "offline":
      return "text-red-500";
    case "deploying":
    case "paused":
      return "text-amber-500";
    case "error":
    case "auth_error":
      return "text-red-500";
    case "no_model_loaded":
      return "text-zinc-500";
    default:
      return "text-zinc-500";
  }
}

function getStatusDotColor(status: BackendStatus): string {
  switch (status) {
    case "online":
      return "bg-green-500";
    case "offline":
      return "bg-red-500";
    case "deploying":
    case "paused":
      return "bg-amber-500";
    case "error":
    case "auth_error":
      return "bg-red-500";
    case "no_model_loaded":
      return "bg-zinc-500";
    default:
      return "bg-zinc-500";
  }
}

export function BackendSettings() {
  const {
    backends,
    activeBackend,
    removeBackend,
    setActiveBackend,
    saveCredential,
  } = useBackends();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingCredential, setEditingCredential] = useState<string | null>(
    null,
  );
  const [credentialInput, setCredentialInput] = useState("");
  const [savingCredential, setSavingCredential] = useState(false);
  const [hfOperations, setHfOperations] = useState<Record<string, string>>({});

  const handleRemove = async (id: string) => {
    if (confirm("Are you sure you want to remove this backend?")) {
      try {
        await removeBackend(id);
      } catch (error) {
        console.error("Failed to remove backend:", error);
      }
    }
  };

  const handleSetActive = async (id: string) => {
    try {
      await setActiveBackend(id);
    } catch (error) {
      console.error("Failed to set active backend:", error);
    }
  };

  const handleSaveCredential = async (backendId: string) => {
    if (!credentialInput.trim()) return;

    setSavingCredential(true);
    try {
      await saveCredential(backendId, credentialInput.trim());
      setEditingCredential(null);
      setCredentialInput("");
    } catch (error) {
      console.error("Failed to save credential:", error);
    } finally {
      setSavingCredential(false);
    }
  };

  const startEditingCredential = (backendId: string) => {
    setEditingCredential(backendId);
    setCredentialInput("");
  };

  const cancelEditingCredential = () => {
    setEditingCredential(null);
    setCredentialInput("");
  };

  const handleHfOperation = async (
    backendId: string,
    operation: "check" | "pause" | "resume" | "delete",
  ) => {
    setHfOperations((prev) => ({ ...prev, [backendId]: operation }));
    
    try {
      if (operation === "check") {
        await invoke("check_hf_endpoint_status", { backendId });
      } else if (operation === "pause") {
        await invoke("pause_hf_endpoint", { backendId });
      } else if (operation === "resume") {
        await invoke("resume_hf_endpoint", { backendId });
      } else if (operation === "delete") {
        if (!confirm("Are you sure you want to delete this HuggingFace endpoint? This action cannot be undone.")) {
          return;
        }
        await invoke("delete_hf_endpoint", { backendId });
      }
      
      // Refresh backend list to get updated status
      window.location.reload(); // Simple refresh for now
    } catch (error) {
      console.error(`Failed to ${operation} HF endpoint:`, error);
      alert(`Failed to ${operation} endpoint: ${error}`);
    } finally {
      setHfOperations((prev) => {
        const next = { ...prev };
        delete next[backendId];
        return next;
      });
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* Backend List */}
        {backends.length === 0 ? (
          <div className="text-center py-8">
            <Server className="h-8 w-8 text-[var(--muted)] mx-auto mb-3" />
            <p className="text-sm text-[var(--muted)]">
              No backends configured yet.
            </p>
            <p className="text-xs text-[var(--muted)] mt-1">
              Add a custom endpoint to start using remote inference.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {backends.map((backend) => {
              const IconComponent = TYPE_ICONS[backend.backend_type];
              const isActive = activeBackend?.id === backend.id;
              const canDelete = backend.backend_type !== "local_sidecar";
              const needsAuth = backend.status === "auth_error";
              const isEditing = editingCredential === backend.id;

              return (
                <div
                  key={backend.id}
                  className={cn(
                    "rounded-lg border p-4 transition-colors",
                    isActive
                      ? "border-accent bg-accent/5"
                      : "border-[var(--border)] bg-[var(--background)]",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <IconComponent className="h-5 w-5 text-[var(--muted)] mt-0.5 shrink-0" />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-[var(--foreground)] truncate">
                          {backend.name}
                        </h4>
                        <span className="text-xs px-2 py-0.5 rounded bg-[var(--surface)] text-[var(--muted)] shrink-0">
                          {TYPE_LABELS[backend.backend_type]}
                        </span>
                        {isActive && (
                          <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent font-medium shrink-0">
                            Active
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-1.5">
                          <Circle
                            className={cn(
                              "h-2.5 w-2.5 fill-current",
                              getStatusDotColor(backend.status),
                            )}
                          />
                          <span
                            className={cn(
                              "text-xs capitalize",
                              getStatusColor(backend.status),
                            )}
                          >
                            {backend.status.replace("_", " ")}
                          </span>
                        </div>
                        {backend.latency_ms && (
                          <span className="text-xs text-[var(--muted)]">
                            {backend.latency_ms}ms
                          </span>
                        )}
                      </div>

                      {backend.url && (
                        <p className="text-xs font-mono text-[var(--muted)] break-all mb-3">
                          {backend.url}
                        </p>
                      )}

                      {/* Credential input for auth errors */}
                      {needsAuth && !isEditing && (
                        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 mb-3">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-4 w-4 text-red-400" />
                            <span className="text-sm font-medium text-red-300">
                              Authentication Required
                            </span>
                          </div>
                          <p className="text-xs text-red-400 mb-2">
                            This backend requires an API key to function.
                          </p>
                          <button
                            onClick={() => startEditingCredential(backend.id)}
                            className="flex items-center gap-1.5 text-xs text-red-300 hover:text-red-200 transition-colors"
                          >
                            <Key className="h-3 w-3" />
                            Add API Key
                          </button>
                        </div>
                      )}

                      {/* Credential editing */}
                      {isEditing && (
                        <div className="rounded-lg bg-[var(--surface)] border border-[var(--border)] p-3 mb-3">
                          <label className="block text-xs font-medium text-[var(--muted)] mb-2">
                            API Key
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="password"
                              value={credentialInput}
                              onChange={(e) =>
                                setCredentialInput(e.target.value)
                              }
                              placeholder="sk-..."
                              className="flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                            />
                            <button
                              onClick={() => handleSaveCredential(backend.id)}
                              disabled={
                                !credentialInput.trim() || savingCredential
                              }
                              className="px-3 py-1.5 rounded-md bg-accent text-white text-xs hover:bg-accent/90 disabled:opacity-50 transition-colors"
                            >
                              {savingCredential ? "Saving..." : "Save"}
                            </button>
                            <button
                              onClick={cancelEditingCredential}
                              className="px-3 py-1.5 rounded-md border border-[var(--border)] text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {!isActive && (
                          <button
                            onClick={() => handleSetActive(backend.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-accent hover:bg-accent/10 transition-colors"
                          >
                            <Check className="h-3 w-3" />
                            Set Active
                          </button>
                        )}

                        {backend.backend_type === "custom_url" &&
                          !needsAuth &&
                          !isEditing && (
                            <button
                              onClick={() => startEditingCredential(backend.id)}
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
                            >
                              <Key className="h-3 w-3" />
                              Update Key
                            </button>
                          )}

                        {canDelete && backend.backend_type !== "hf_endpoint" && (
                          <button
                            onClick={() => handleRemove(backend.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-red-500 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                            Remove
                          </button>
                        )}
                        
                        {/* HF Endpoint specific controls */}
                        {backend.backend_type === "hf_endpoint" && (
                          <>
                            {backend.status === "deploying" && (
                              <button
                                onClick={() => handleHfOperation(backend.id, "check")}
                                disabled={hfOperations[backend.id] === "check"}
                                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-blue-500 hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                              >
                                {hfOperations[backend.id] === "check" ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-3 w-3" />
                                )}
                                {hfOperations[backend.id] === "check" ? "Checking..." : "Check Status"}
                              </button>
                            )}
                            
                            {backend.status === "online" && (
                              <button
                                onClick={() => handleHfOperation(backend.id, "pause")}
                                disabled={hfOperations[backend.id] === "pause"}
                                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-amber-500 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                              >
                                {hfOperations[backend.id] === "pause" ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Pause className="h-3 w-3" />
                                )}
                                {hfOperations[backend.id] === "pause" ? "Pausing..." : "Pause"}
                              </button>
                            )}
                            
                            {backend.status === "paused" && (
                              <button
                                onClick={() => handleHfOperation(backend.id, "resume")}
                                disabled={hfOperations[backend.id] === "resume"}
                                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-green-500 hover:bg-green-500/10 transition-colors disabled:opacity-50"
                              >
                                {hfOperations[backend.id] === "resume" ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Play className="h-3 w-3" />
                                )}
                                {hfOperations[backend.id] === "resume" ? "Resuming..." : "Resume"}
                              </button>
                            )}
                            
                            <button
                              onClick={() => handleHfOperation(backend.id, "delete")}
                              disabled={hfOperations[backend.id] === "delete"}
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                            >
                              {hfOperations[backend.id] === "delete" ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                              {hfOperations[backend.id] === "delete" ? "Deleting..." : "Delete Endpoint"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add Backend Button */}
        <button
          onClick={() => setShowAddDialog(true)}
          className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Custom Endpoint
        </button>
      </div>

      {/* Add Backend Dialog */}
      <AddBackendDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
      />
    </>
  );
}
