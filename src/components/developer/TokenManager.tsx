import { useEffect, useState } from "react";
import { useAuth, type Permission } from "../../stores/auth";
import { cn } from "../ui/cn";
import {
  Key,
  Plus,
  Trash2,
  Ban,
  Copy,
  Check,
  Shield,
  ShieldAlert,
} from "lucide-react";

const PERMISSIONS: { id: Permission; label: string; description: string }[] = [
  { id: "inference", label: "Inference", description: "Chat completions & embeddings" },
  { id: "model_management", label: "Model Management", description: "Load & unload models" },
  { id: "server_admin", label: "Server Admin", description: "Start/stop server, change config" },
  { id: "downloads", label: "Downloads", description: "Download new models" },
];

export function TokenManager() {
  const {
    tokens,
    config,
    lastCreatedPlaintext,
    refreshTokens,
    refreshConfig,
    createToken,
    revokeToken,
    deleteToken,
    setConfig,
    clearPlaintext,
  } = useAuth();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPerms, setNewPerms] = useState<Permission[]>(["inference"]);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    refreshTokens();
    refreshConfig();
  }, [refreshTokens, refreshConfig]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createToken(newName.trim(), newPerms);
      setNewName("");
      setNewPerms(["inference"]);
      setShowCreate(false);
    } catch (e) {
      console.error("Failed to create token:", e);
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const togglePerm = (perm: Permission) => {
    setNewPerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  return (
    <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Key className="h-5 w-5 text-[var(--muted)]" />
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Authentication
          </h2>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.authRequired}
            onChange={(e) => setConfig({ authRequired: e.target.checked })}
            className="rounded"
          />
          <span className="text-[var(--muted)]">Require Auth</span>
          {config.authRequired ? (
            <ShieldAlert className="h-4 w-4 text-yellow-500" />
          ) : (
            <Shield className="h-4 w-4 text-green-500" />
          )}
        </label>
      </div>

      {!config.authRequired && (
        <p className="text-xs text-[var(--muted)] bg-[var(--background)] rounded-lg px-3 py-2">
          Authentication is disabled. All API requests are allowed without tokens.
        </p>
      )}

      {/* Token created notification */}
      {lastCreatedPlaintext && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 space-y-2">
          <p className="text-xs font-medium text-green-600 dark:text-green-400">
            ✅ Token created! Copy it now — it won't be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-[var(--background)] px-2 py-1 text-xs font-mono text-[var(--foreground)] select-all">
              {lastCreatedPlaintext}
            </code>
            <button
              onClick={() => handleCopy(lastCreatedPlaintext)}
              className="text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </button>
            <button
              onClick={clearPlaintext}
              className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Create token form */}
      {showCreate ? (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] p-4 space-y-3">
          <input
            type="text"
            placeholder="Token name (e.g., IDE Integration)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          />
          <div className="space-y-1">
            <p className="text-xs font-medium text-[var(--muted)]">Permissions:</p>
            <div className="grid grid-cols-2 gap-2">
              {PERMISSIONS.map((p) => (
                <label
                  key={p.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs cursor-pointer transition-colors",
                    newPerms.includes(p.id)
                      ? "border-hf-orange/50 bg-hf-orange/5 text-[var(--foreground)]"
                      : "border-[var(--border-subtle)] text-[var(--muted)]"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={newPerms.includes(p.id)}
                    onChange={() => togglePerm(p.id)}
                    className="rounded"
                  />
                  <div>
                    <span className="font-medium">{p.label}</span>
                    <span className="block text-[10px] opacity-70">{p.description}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowCreate(false)}
              className="px-3 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim() || newPerms.length === 0}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-hf-orange/10 text-hf-orange hover:bg-hf-orange/20 disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create Token"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 text-xs font-medium text-hf-orange hover:text-hf-orange/80 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Create Token
        </button>
      )}

      {/* Token list */}
      <div className="space-y-2">
        {(tokens ?? []).length === 0 ? (
          <p className="text-xs text-[var(--muted)] text-center py-4">
            No tokens created yet.
          </p>
        ) : (
          (tokens ?? []).map((token) => (
            <TokenRow
              key={token.id}
              token={token}
              onRevoke={() => revokeToken(token.id)}
              onDelete={() => deleteToken(token.id)}
            />
          ))
        )}
      </div>
    </section>
  );
}

function TokenRow({
  token,
  onRevoke,
  onDelete,
}: {
  token: {
    id: string;
    name: string;
    tokenPrefix: string;
    permissions: Permission[];
    createdAt: number;
    lastUsedAt: number | null;
    requestCount: number;
    isActive: boolean;
  };
  onRevoke: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2 text-xs",
        token.isActive
          ? "border-[var(--border-subtle)] bg-[var(--background)]"
          : "border-red-500/20 bg-red-500/5 opacity-60"
      )}
    >
      <Key className="h-3.5 w-3.5 text-[var(--muted)] shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-[var(--foreground)] truncate">
            {token.name}
          </span>
          <code className="text-[10px] text-[var(--muted)] font-mono">
            {token.tokenPrefix}
          </code>
          {!token.isActive && (
            <span className="text-[10px] text-red-500 font-medium">REVOKED</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[var(--muted)]">
          {token.permissions.map((p) => (
            <span key={p} className="rounded bg-[var(--surface)] px-1 py-0.5 text-[10px]">
              {p}
            </span>
          ))}
          <span className="text-[10px]">• {token.requestCount} requests</span>
        </div>
      </div>
      {token.isActive && (
        <button
          onClick={onRevoke}
          title="Revoke token"
          className="text-yellow-500 hover:text-yellow-600"
        >
          <Ban className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        onClick={onDelete}
        title="Delete token"
        className="text-red-500 hover:text-red-600"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
