import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface LoadedModel {
  instanceId: string;
  modelName: string;
  identifier: string;
  status: string;
  port: number;
  requestCount: number;
  totalTokensGenerated: number;
  avgTokensPerSec: number;
  vramUsageMb: number;
  ramUsageMb: number;
  contextLength: number;
  draftModel: string | null;
}

interface MemoryInfo {
  totalRamMb: number;
  availableRamMb: number;
  totalVramMb: number | null;
  availableVramMb: number | null;
  modelsRamMb: number;
  modelsVramMb: number;
}

/** Inference metrics dashboard showing per-model and aggregate statistics. */
export default function MetricsDashboard() {
  const [models, setModels] = useState<LoadedModel[]>([]);
  const [memory, setMemory] = useState<MemoryInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const [m, mem] = await Promise.all([
        invoke<LoadedModel[]>('mm_list_loaded_models'),
        invoke<MemoryInfo>('mm_get_memory_usage'),
      ]);
      setModels(m ?? []);
      setMemory(mem);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  const totalRequests = models.reduce((acc, m) => acc + (m.requestCount || 0), 0);
  const totalTokens = models.reduce((acc, m) => acc + (m.totalTokensGenerated || 0), 0);
  const avgTps = models.length > 0
    ? models.reduce((acc, m) => acc + (m.avgTokensPerSec || 0), 0) / models.length
    : 0;

  if (loading) {
    return <p className="text-zinc-400 text-sm">Loading metrics...</p>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Inference Metrics</h3>

      {/* Aggregate stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Loaded Models" value={String(models.length)} />
        <StatCard label="Total Requests" value={totalRequests.toLocaleString()} />
        <StatCard label="Total Tokens" value={totalTokens.toLocaleString()} />
        <StatCard label="Avg Tokens/s" value={avgTps.toFixed(1)} />
      </div>

      {/* Memory overview */}
      {memory && (
        <div className="bg-zinc-800 rounded-lg p-3 space-y-2">
          <h4 className="text-sm font-medium text-zinc-300">Memory Usage</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-zinc-400">RAM</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-zinc-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${Math.min(100, ((memory.totalRamMb - memory.availableRamMb) / memory.totalRamMb) * 100)}%` }}
                  />
                </div>
                <span className="text-zinc-300 text-xs">
                  {((memory.totalRamMb - memory.availableRamMb) / 1024).toFixed(1)} / {(memory.totalRamMb / 1024).toFixed(1)} GB
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">Models: {(memory.modelsRamMb / 1024).toFixed(1)} GB</p>
            </div>
            {memory.totalVramMb != null && (
              <div>
                <p className="text-zinc-400">VRAM</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-zinc-700 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${Math.min(100, ((memory.totalVramMb! - (memory.availableVramMb || 0)) / memory.totalVramMb!) * 100)}%` }}
                    />
                  </div>
                  <span className="text-zinc-300 text-xs">
                    {((memory.totalVramMb! - (memory.availableVramMb || 0)) / 1024).toFixed(1)} / {(memory.totalVramMb! / 1024).toFixed(1)} GB
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-1">Models: {(memory.modelsVramMb / 1024).toFixed(1)} GB</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Per-model metrics */}
      {models.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-zinc-300">Per-Model Metrics</h4>
          {models.map((model) => (
            <div key={model.instanceId} className="bg-zinc-800 rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-white font-medium text-sm">{model.identifier || model.modelName}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  model.status === 'ready' ? 'bg-green-600 text-white' : 'bg-yellow-600 text-white'
                }`}>
                  {model.status}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs text-zinc-400">
                <span>Requests: {model.requestCount}</span>
                <span>Tokens: {(model.totalTokensGenerated || 0).toLocaleString()}</span>
                <span>Avg t/s: {(model.avgTokensPerSec || 0).toFixed(1)}</span>
                <span>Port: {model.port}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-zinc-500">
                <span>RAM: {model.ramUsageMb}MB</span>
                <span>VRAM: {model.vramUsageMb}MB</span>
                <span>Ctx: {model.contextLength}</span>
              </div>
              {model.draftModel && (
                <p className="text-xs text-blue-400">⚡ Speculative decoding enabled</p>
              )}
            </div>
          ))}
        </div>
      )}

      {models.length === 0 && (
        <p className="text-zinc-500 text-sm text-center py-4">No models loaded. Load a model to see metrics.</p>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-800 rounded-lg p-3 text-center">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="text-xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}
