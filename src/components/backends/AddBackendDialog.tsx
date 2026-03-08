import { useState } from "react";
import { useBackends } from "../../stores/backends";
import {
  X,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Plus,
  Eye,
  EyeOff,
} from "lucide-react";
import type { ConnectionTestResult } from "../../stores/backends";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function AddBackendDialog({ isOpen, onClose }: Props) {
  const { addBackend, testConnection } = useBackends();
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    apiKey: "",
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(
    null,
  );
  const [testing, setTesting] = useState(false);
  const [adding, setAdding] = useState(false);

  const handleClose = () => {
    setFormData({ name: "", url: "", apiKey: "" });
    setTestResult(null);
    setTesting(false);
    setAdding(false);
    setShowApiKey(false);
    onClose();
  };

  const handleTestConnection = async () => {
    if (!formData.url.trim()) return;

    setTesting(true);
    try {
      const result = await testConnection(
        formData.url.trim(),
        formData.apiKey.trim() || undefined,
      );
      setTestResult(result);
    } catch (error) {
      setTestResult({
        online: false,
        latency_ms: null,
        model_name: null,
        error: String(error),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleAddBackend = async () => {
    if (!formData.name.trim() || !formData.url.trim() || !testResult?.online)
      return;

    setAdding(true);
    try {
      await addBackend(
        formData.name.trim(),
        formData.url.trim(),
        formData.apiKey.trim() || undefined,
      );
      handleClose();
    } catch (error) {
      console.error("Failed to add backend:", error);
      // TODO: Show error to user
    } finally {
      setAdding(false);
    }
  };

  const isFormValid = formData.name.trim() && formData.url.trim();
  const canAdd = isFormValid && testResult?.online;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-w-md w-full rounded-2xl border border-zinc-700 bg-zinc-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-zinc-700">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
            <Plus className="h-4 w-4 text-accent" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-zinc-100">
              Add Custom Endpoint
            </h2>
            <p className="text-xs text-zinc-400">
              Connect to an OpenAI-compatible API server
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="My Server"
              className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
            />
          </div>

          {/* URL */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              URL <span className="text-red-400">*</span>
            </label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) =>
                setFormData({ ...formData, url: e.target.value })
              }
              placeholder="https://your-server.com/v1"
              className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 font-mono focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
            />
          </div>

          {/* API Key */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              API Key <span className="text-xs text-zinc-500">(optional)</span>
            </label>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={formData.apiKey}
                onChange={(e) =>
                  setFormData({ ...formData, apiKey: e.target.value })
                }
                placeholder="sk-..."
                className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 pr-10 text-sm text-zinc-100 placeholder-zinc-500 font-mono focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Test Connection */}
          <div>
            <div className="flex gap-2">
              <button
                onClick={handleTestConnection}
                disabled={!formData.url.trim() || testing}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-600 text-sm text-zinc-300 hover:text-zinc-100 hover:border-zinc-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                {testing ? "Testing..." : "Test Connection"}
              </button>
            </div>

            {/* Test Result */}
            {testResult && (
              <div
                className={`mt-3 rounded-lg p-3 border ${
                  testResult.online
                    ? "border-green-500/20 bg-green-500/10"
                    : "border-red-500/20 bg-red-500/10"
                }`}
              >
                <div className="flex items-center gap-2">
                  {testResult.online ? (
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                  )}
                  <span
                    className={`text-sm font-medium ${
                      testResult.online ? "text-green-300" : "text-red-300"
                    }`}
                  >
                    {testResult.online
                      ? "Connection successful"
                      : "Connection failed"}
                  </span>
                </div>
                {testResult.online && (
                  <div className="mt-2 text-xs text-zinc-400 space-y-1">
                    {testResult.latency_ms && (
                      <div>Latency: {testResult.latency_ms}ms</div>
                    )}
                    {testResult.model_name && (
                      <div>Model: {testResult.model_name}</div>
                    )}
                  </div>
                )}
                {testResult.error && (
                  <div className="mt-2 text-xs text-red-400 font-mono">
                    {testResult.error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleAddBackend}
              disabled={!canAdd || adding}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {adding ? "Adding..." : "Add Backend"}
            </button>
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-lg border border-zinc-600 text-sm text-zinc-300 hover:text-zinc-100 hover:border-zinc-500 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
