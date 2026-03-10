import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useChatStore } from "../stores/chat";
import { usePresetStore, type Preset } from "../stores/presetStore";
import { useInference } from "../stores/inference";
import { useBackends } from "../stores/backends";
import { useImports } from "../stores/imports";
import type { DetectedServer } from "../stores/imports";
import { SessionSidebar } from "../components/chat/SessionSidebar";
import { ChatMessage } from "../components/chat/ChatMessage";
import { ChatInput } from "../components/chat/ChatInput";
import { ModelRunPanel } from "../components/models/ModelRunPanel";
import { LoadedModelsPanel } from "../components/models/LoadedModelsPanel";
import { BackendSelector } from "../components/backends/BackendSelector";
import {
  Bot,
  Settings2,
  ChevronDown,
  ChevronUp,
  Zap,
  Globe,
  Search,
  FolderOpen,
  Radar,
  Loader2,
  HardDrive,
  FileDown,
  X,
} from "lucide-react";

export function ChatPage() {
  const {
    sessions,
    currentSessionId,
    isStreaming,
    createSession,
    sendMessage,
    stopStreaming,
    setSystemPrompt,
    setPreset,
  } = useChatStore();
  const { info, load } = useInference();
  const { activeBackend } = useBackends();
  const { autoDetectAll, isScanning, startOllama, ollamaStarting } = useImports();
  const { presets, fetchPresets } = usePresetStore();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [showDetectResults, setShowDetectResults] = useState(false);
  const [detectResults, setDetectResults] = useState<DetectedServer[]>([]);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<string | null>(null);

  const session = sessions.find((s) => s.id === currentSessionId);
  const isRunning = info.status === "running";
  const canSendMessage = activeBackend && (
    activeBackend.backend_type === "local_sidecar" ? isRunning : 
    activeBackend.status === "online"
  );

  // Create a default session on first visit
  useEffect(() => {
    if (sessions.length === 0) {
      createSession("Chat 1");
    }
  }, [sessions.length, createSession]);

  // Fetch presets on mount
  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  // Scroll to bottom on new messages
  const lastMessageContent =
    session?.messages[session.messages.length - 1]?.content;
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages.length, lastMessageContent]);

  const handleSend = async (text: string) => {
    if (!session || !canSendMessage) return;
    await sendMessage(session.id, text);
  };

  // FR-010: Import GGUF file via native file picker
  const handleImportGguf = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        filters: [{ name: "GGUF Models", extensions: ["gguf"] }],
      });
      if (selected) {
        const filePath = typeof selected === "string" ? selected : selected;
        if (typeof filePath === "string") {
          const { importFile } = useImports.getState();
          const model = await importFile(filePath);
          setImportStatus(`Imported "${model.name}" — select it below to load`);
          setTimeout(() => setImportStatus(null), 5000);
        }
      }
    } catch (e) {
      setImportStatus(`Import failed: ${String(e)}`);
      setTimeout(() => setImportStatus(null), 5000);
    }
  }, []);

  // FR-011 + FR-012: Auto-detect Ollama and LM Studio models
  const handleAutoDetect = useCallback(async () => {
    const results = await autoDetectAll();
    setDetectResults(results);
    setShowDetectResults(true);
  }, [autoDetectAll]);

  // FR-013: Load a detected model or connect to Ollama
  const handleLoadDetected = useCallback(async (serverType: string, name: string, path?: string) => {
    setShowDetectResults(false);
    if (serverType === "ollama") {
      // Ollama models are served by the running Ollama daemon — connect as a backend
      try {
        const { addBackend, setActiveBackend } = useBackends.getState();
        const backend = await addBackend(
          `Ollama: ${name}`,
          "http://127.0.0.1:11434/v1",
          undefined,
          "custom_url",
        );
        await setActiveBackend(backend.id);
        setImportStatus(`Connected to Ollama model "${name}"`);
        setTimeout(() => setImportStatus(null), 5000);
      } catch (e) {
        setImportStatus(`Failed to connect to Ollama: ${String(e)}`);
        setTimeout(() => setImportStatus(null), 5000);
      }
    } else {
      // LM Studio / manual imports have a local GGUF path
      const modelPath = path ?? name;
      const modelName = name.split("/").pop() ?? name;
      await load({ modelPath, modelName });
    }
  }, [load]);

  const totalDetectedModels = detectResults.reduce(
    (n, s) => n + s.models.length, 0
  );

  const handleStartOllama = useCallback(async () => {
    setOllamaStatus(null);
    try {
      const result = await startOllama();
      if (result === "already_running") {
        setOllamaStatus("Ollama is already running!");
      } else if (result === "started") {
        setOllamaStatus("Ollama started successfully!");
        // Re-detect to refresh models
        const results = await autoDetectAll();
        setDetectResults(results);
        setShowDetectResults(true);
      } else {
        setOllamaStatus("Ollama is starting up...");
      }
      setTimeout(() => setOllamaStatus(null), 5000);
    } catch (e) {
      setOllamaStatus(`Error: ${String(e)}`);
      setTimeout(() => setOllamaStatus(null), 8000);
    }
  }, [startOllama, autoDetectAll]);

  return (
    <div className="flex h-full overflow-hidden">
      <SessionSidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        {!canSendMessage ? (
          /* No backend available or not ready — show setup prompt */
          <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8 overflow-y-auto">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-purple-500/20">
              {activeBackend?.backend_type === "local_sidecar" ? (
                <Bot className="h-8 w-8 text-accent dark:text-accent-light" />
              ) : (
                <Globe className="h-8 w-8 text-accent dark:text-accent-light" />
              )}
            </div>
            <div className="text-center max-w-md">
              <h2 className="text-lg font-bold mb-1">
                {!activeBackend 
                  ? "Welcome to HugBrowse" 
                  : activeBackend.backend_type === "local_sidecar" 
                    ? (info.status === "error" ? "Model Loading Failed" : info.status === "loading" ? "Loading Model…" : "Get Started — Load a Model")
                    : "Backend Not Connected"
                }
              </h2>
              <p className="text-sm text-[var(--muted)] leading-relaxed">
                {!activeBackend 
                  ? "Select a compute backend to start chatting with AI."
                  : activeBackend.backend_type === "local_sidecar"
                    ? (info.status === "error" && info.error 
                        ? info.error 
                        : info.status === "loading" 
                          ? "Please wait while the model loads…" 
                          : "Follow these steps to chat with a local AI model:")
                    : `"${activeBackend.name}" status: ${activeBackend.status.replace(/_/g, " ")}. Try reconnecting or switch backends.`
                }
              </p>
            </div>

            {/* Step-by-step guide for local sidecar */}
            {activeBackend?.backend_type === "local_sidecar" && (
              <div className="w-full max-w-md">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3 mb-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-hf-orange/20 text-hf-orange text-xs font-bold shrink-0">1</span>
                    <div>
                      <p className="text-sm font-medium">Download a GGUF model</p>
                      <p className="text-xs text-[var(--muted)]">Browse Hugging Face for GGUF models or import one from your computer.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-hf-orange/20 text-hf-orange text-xs font-bold shrink-0">2</span>
                    <div>
                      <p className="text-sm font-medium">Load the model</p>
                      <p className="text-xs text-[var(--muted)]">Select a downloaded model from the panel below and click "Load Model".</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-hf-orange/20 text-hf-orange text-xs font-bold shrink-0">3</span>
                    <div>
                      <p className="text-sm font-medium">Start chatting!</p>
                      <p className="text-xs text-[var(--muted)]">Once loaded, type a message below to begin.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* FR-009 / FR-010 / FR-011: Action buttons for model discovery */}
            {(!activeBackend || activeBackend.backend_type === "local_sidecar") && (
              <div className="w-full max-w-md space-y-4">
                {/* Quick action buttons */}
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => navigate("/")}
                    className="flex flex-col items-center gap-2 rounded-xl border-2 border-hf-orange/40 bg-hf-orange/5 p-4 hover:bg-hf-orange/10 transition-colors"
                    aria-label="Browse Models"
                  >
                    <Search className="h-5 w-5 text-hf-orange" />
                    <span className="text-xs font-semibold text-hf-orange">Browse Models</span>
                  </button>
                  <button
                    onClick={handleImportGguf}
                    className="flex flex-col items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 hover:bg-[var(--surface-hover)] transition-colors"
                    aria-label="Import GGUF File"
                  >
                    <FolderOpen className="h-5 w-5 text-accent dark:text-accent-light" />
                    <span className="text-xs font-medium">Import GGUF</span>
                  </button>
                  <button
                    onClick={handleAutoDetect}
                    disabled={isScanning}
                    className="flex flex-col items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50"
                    aria-label="Auto-Detect Local Models"
                  >
                    {isScanning ? (
                      <Loader2 className="h-5 w-5 animate-spin text-accent dark:text-accent-light" />
                    ) : (
                      <Radar className="h-5 w-5 text-accent dark:text-accent-light" />
                    )}
                    <span className="text-xs font-medium">Auto-Detect</span>
                  </button>
                </div>

                {/* Ollama status message */}
                {ollamaStatus && (
                  <div className="flex items-center gap-2 rounded-lg bg-accent/10 border border-accent/20 px-3 py-2">
                    <Zap className="h-4 w-4 text-accent shrink-0" />
                    <p className="text-xs text-accent dark:text-accent-light flex-1">{ollamaStatus}</p>
                  </div>
                )}

                {/* Import status message */}
                {importStatus && (
                  <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2">
                    <FileDown className="h-4 w-4 text-green-500 shrink-0" />
                    <p className="text-xs text-green-600 dark:text-green-400 flex-1">{importStatus}</p>
                  </div>
                )}

                {/* FR-014: Auto-detect results panel */}
                {showDetectResults && (
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Radar className="h-4 w-4" />
                        Detected Models
                        {totalDetectedModels > 0 && (
                          <span className="text-xs font-normal text-[var(--muted)]">
                            ({totalDetectedModels} found)
                          </span>
                        )}
                      </h3>
                      <button
                        onClick={() => setShowDetectResults(false)}
                        className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                        aria-label="Close detection results"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {totalDetectedModels === 0 ? (
                        <div className="px-4 py-6 text-center space-y-3">
                          <p className="text-sm text-[var(--muted)]">
                            No local model servers detected.
                          </p>
                          <p className="text-xs text-[var(--muted)]">
                            Import a GGUF file or browse models to download one.
                          </p>
                          <button
                            onClick={handleStartOllama}
                            disabled={ollamaStarting}
                            className="inline-flex items-center gap-2 rounded-lg bg-accent/10 border border-accent/30 px-4 py-2 text-xs font-medium text-accent hover:bg-accent/20 disabled:opacity-50 transition-colors"
                          >
                            {ollamaStarting ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Zap className="h-3.5 w-3.5" />
                            )}
                            {ollamaStarting ? "Starting Ollama..." : "Start Ollama Server"}
                          </button>
                        </div>
                      ) : (
                        detectResults.map((server) => (
                          <div key={server.type}>
                            <div className="px-4 py-2 bg-[var(--background)] border-b border-[var(--border)] flex items-center justify-between">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] flex items-center gap-2">
                                <HardDrive className="h-3 w-3" />
                                {server.type === "ollama" ? "Ollama" : "LM Studio"}
                                <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                                  server.status === "running" ? "bg-green-500" : "bg-yellow-500"
                                }`} />
                              </span>
                              {server.type === "ollama" && server.status !== "running" && (
                                <button
                                  onClick={handleStartOllama}
                                  disabled={ollamaStarting}
                                  className="flex items-center gap-1.5 rounded-md bg-accent/10 px-2.5 py-1 text-[10px] font-medium text-accent hover:bg-accent/20 disabled:opacity-50 transition-colors"
                                >
                                  {ollamaStarting ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Zap className="h-3 w-3" />
                                  )}
                                  Start
                                </button>
                              )}
                            </div>
                            {server.models.length > 0 ? (
                              server.models.map((model) => (
                                <div
                                  key={`${server.type}-${model.name}`}
                                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--surface-hover)] transition-colors border-b border-[var(--border)] last:border-b-0"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{model.name}</p>
                                    <p className="text-[11px] text-[var(--muted)]">
                                      {model.size > 0
                                        ? `${(model.size / 1_073_741_824).toFixed(1)} GB`
                                        : "Size unknown"}
                                      {" · "}
                                      {server.type === "ollama" ? "Ollama" : "LM Studio"}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => handleLoadDetected(server.type, model.name, model.path)}
                                    className="shrink-0 rounded-lg bg-hf-orange px-3 py-1.5 text-xs font-medium text-white hover:bg-hf-orange/90 transition-colors"
                                  >
                                    {server.type === "ollama" ? "Connect" : "Load"}
                                  </button>
                                </div>
                              ))
                            ) : (
                              <div className="px-4 py-3 text-xs text-[var(--muted)]">
                                {server.status !== "running"
                                  ? `${server.type === "ollama" ? "Ollama" : "LM Studio"} is not running`
                                  : "No models found"}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Existing model run panel */}
                <ModelRunPanel />
              </div>
            )}

            {/* Show backend selector for non-local backends */}
            {activeBackend && activeBackend.backend_type !== "local_sidecar" && (
              <div className="w-full max-w-md space-y-3">
                <p className="text-xs text-[var(--muted)] text-center">Switch backend or check connection:</p>
                <BackendSelector className="flex justify-center" />
              </div>
            )}
          </div>
        ) : !session ? (
          <div className="flex flex-1 items-center justify-center text-[var(--muted)]">
            <p className="text-sm">
              Select or create a session to start chatting.
            </p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="border-b border-[var(--border-subtle)] px-4 py-3">
              <div className="flex items-center gap-3">
                <BackendSelector />
                {session && (presets ?? []).length > 0 && (
                  <select
                    value={session.presetId ?? ""}
                    onChange={(e) => setPreset(session.id, e.target.value || undefined)}
                    className="text-xs rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-1.5 outline-none focus:ring-1 focus:ring-[var(--ring)]"
                    title="Select inference preset"
                  >
                    <option value="">No Preset</option>
                    {(presets ?? []).map((p: Preset) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )}
                {session && (
                  <div className="flex-1 text-center">
                    <h2 className="text-sm font-medium text-[var(--foreground)] truncate">
                      {session.title}
                    </h2>
                  </div>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto">
              {session.messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-[var(--muted)]">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-hover)]">
                    <Bot className="h-7 w-7 opacity-40" />
                  </div>
                  <p className="text-sm">
                    Send a message to start the conversation.
                  </p>
                  <p className="text-xs opacity-60 font-mono px-3 py-1.5 rounded-lg bg-[var(--surface-hover)]">
                    {activeBackend?.backend_type === "local_sidecar" 
                      ? `${info.model_name || "No model loaded"} · port ${info.port}`
                      : `${activeBackend?.name || "Unknown"} · ${activeBackend?.model_name || "remote model"}`
                    }
                  </p>
                </div>
              ) : (
                <div className="pb-2">
                  {session.messages.map((msg) => (
                    <ChatMessage key={msg.id} message={msg} />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <ChatInput
              onSend={handleSend}
              onStop={stopStreaming}
              isStreaming={isStreaming}
              disabled={!canSendMessage}
            />
          </>
        )}
      </div>

      {/* Right sidebar — model status when running or backend info */}
      {(isRunning || (activeBackend && activeBackend.backend_type !== "local_sidecar")) && (
        <aside className="w-72 shrink-0 border-l border-[var(--border-subtle)] bg-[var(--surface)] p-4 space-y-3 overflow-y-auto">
          <ModelRunPanel />
          <LoadedModelsPanel />

          {/* System Prompt Editor */}
          {session && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] overflow-hidden">
              <button
                onClick={() => setShowSystemPrompt(!showSystemPrompt)}
                className="flex items-center gap-2 w-full text-left px-3 py-2.5 hover:bg-[var(--surface-hover)] transition-colors"
              >
                <Settings2 className="h-3.5 w-3.5 text-[var(--muted)]" />
                <h4 className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider flex-1">
                  System Prompt
                </h4>
                {showSystemPrompt ? (
                  <ChevronUp className="h-3 w-3 text-[var(--muted)]" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-[var(--muted)]" />
                )}
              </button>
              {showSystemPrompt && (
                <div className="px-3 pb-3">
                  <textarea
                    value={session.systemPrompt}
                    onChange={(e) =>
                      setSystemPrompt(session.id, e.target.value)
                    }
                    placeholder="You are a helpful assistant..."
                    rows={4}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs resize-y focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                  />
                </div>
              )}
            </div>
          )}

          {/* Context usage estimate */}
          {session && session.messages.length > 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-3 w-3 text-[var(--muted)]" />
                <h4 className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider">
                  Context Usage
                </h4>
              </div>
              {(() => {
                const chars = session.messages.reduce(
                  (n, m) => n + m.content.length,
                  0,
                );
                const estTokens = Math.ceil(chars / 4);
                const maxTokens = 4096;
                const pct = Math.min(
                  100,
                  Math.round((estTokens / maxTokens) * 100),
                );
                const barColor =
                  pct > 80
                    ? "bg-cant-run dark:bg-cant-run-light"
                    : pct > 50
                      ? "bg-maybe-run dark:bg-maybe-run-light"
                      : "bg-can-run dark:bg-can-run-light";
                return (
                  <>
                    <div className="w-full bg-[var(--surface-hover)] rounded-full h-1.5 mb-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-[var(--muted)] font-mono">
                      ~{estTokens.toLocaleString()} /{" "}
                      {maxTokens.toLocaleString()} tokens ({pct}%)
                    </p>
                  </>
                );
              })()}
            </div>
          )}

          <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="h-3 w-3 text-[var(--muted)]" />
              <h4 className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider">
                API Endpoint
              </h4>
            </div>
            <p className="font-mono text-xs text-accent dark:text-accent-light break-all bg-[var(--surface-hover)] rounded-lg px-2.5 py-1.5">
              http://127.0.0.1:{info.port}/v1
            </p>
            <p className="text-[11px] text-[var(--muted)] mt-1.5">
              OpenAI-compatible — works with any client
            </p>
          </div>
        </aside>
      )}
    </div>
  );
}
