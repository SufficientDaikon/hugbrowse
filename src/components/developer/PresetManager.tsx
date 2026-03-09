import { useEffect, useState } from "react";
import {
  usePresetStore,
  DEFAULT_PARAMETERS,
  type InferenceParameters,
  type Preset,
} from "../../stores/presetStore";

export function PresetManager() {
  const { presets, loading, fetchPresets, createPreset, deletePreset } =
    usePresetStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newSystemPrompt, setNewSystemPrompt] = useState("");
  const [newParams, setNewParams] = useState<InferenceParameters>({
    ...DEFAULT_PARAMETERS,
  });
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createPreset(newName, newDescription, newSystemPrompt, newParams);
      setShowCreate(false);
      setNewName("");
      setNewDescription("");
      setNewSystemPrompt("");
      setNewParams({ ...DEFAULT_PARAMETERS });
    } catch (e) {
      console.error("Failed to create preset:", e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePreset(id);
    } catch (e) {
      console.error("Failed to delete preset:", e);
    }
  };

  return (
    <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Inference Presets</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1.5 text-sm rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
        >
          {showCreate ? "Cancel" : "New Preset"}
        </button>
      </div>

      {showCreate && (
        <div className="space-y-3 p-4 rounded-lg bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--text-secondary)]">
              Name
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--input-bg)] border border-[var(--border-subtle)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="My Custom Preset"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--text-secondary)]">
              Description
            </label>
            <input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--input-bg)] border border-[var(--border-subtle)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="Describe this preset..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--text-secondary)]">
              System Prompt
            </label>
            <textarea
              value={newSystemPrompt}
              onChange={(e) => setNewSystemPrompt(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--input-bg)] border border-[var(--border-subtle)] outline-none focus:ring-1 focus:ring-[var(--accent)] resize-y"
              placeholder="You are a helpful assistant."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-[var(--text-secondary)]">
                Temperature
              </label>
              <input
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={newParams.temperature}
                onChange={(e) =>
                  setNewParams({
                    ...newParams,
                    temperature: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--input-bg)] border border-[var(--border-subtle)] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-[var(--text-secondary)]">
                Max Tokens
              </label>
              <input
                type="number"
                min={1}
                max={131072}
                value={newParams.maxTokens}
                onChange={(e) =>
                  setNewParams({
                    ...newParams,
                    maxTokens: parseInt(e.target.value) || 2048,
                  })
                }
                className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--input-bg)] border border-[var(--border-subtle)] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-[var(--text-secondary)]">
                Top P
              </label>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={newParams.topP}
                onChange={(e) =>
                  setNewParams({
                    ...newParams,
                    topP: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--input-bg)] border border-[var(--border-subtle)] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-[var(--text-secondary)]">
                Top K
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={newParams.topK}
                onChange={(e) =>
                  setNewParams({
                    ...newParams,
                    topK: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--input-bg)] border border-[var(--border-subtle)] outline-none"
              />
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={!newName.trim()}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            Create Preset
          </button>
        </div>
      )}

      {loading && (
        <div className="text-sm text-[var(--text-secondary)]">
          Loading presets...
        </div>
      )}

      {!loading && (presets ?? []).length === 0 && !showCreate && (
        <div className="text-sm text-[var(--text-secondary)] text-center py-6">
          No presets yet. Create one to save your favorite inference settings.
        </div>
      )}

      <div className="space-y-2">
        {(presets ?? []).map((preset: Preset) => (
          <div
            key={preset.id}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] overflow-hidden"
          >
            <div
              className="flex items-center justify-between p-3 cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
              onClick={() =>
                setExpanded(expanded === preset.id ? null : preset.id)
              }
            >
              <div>
                <span className="font-medium text-sm">{preset.name}</span>
                {preset.isDefault && (
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-[var(--accent)] text-white">
                    Default
                  </span>
                )}
                {preset.description && (
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {preset.description}
                  </p>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(preset.id);
                }}
                className="text-xs px-2 py-1 rounded text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Delete
              </button>
            </div>

            {expanded === preset.id && (
              <div className="px-3 pb-3 space-y-2 border-t border-[var(--border-subtle)]">
                {preset.systemPrompt && (
                  <div className="mt-2">
                    <span className="text-xs font-medium text-[var(--text-secondary)]">
                      System Prompt:
                    </span>
                    <p className="text-xs mt-1 p-2 rounded bg-[var(--input-bg)] whitespace-pre-wrap">
                      {preset.systemPrompt}
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-[var(--text-secondary)]">Temp:</span>{" "}
                    {preset.parameters.temperature}
                  </div>
                  <div>
                    <span className="text-[var(--text-secondary)]">
                      Max Tokens:
                    </span>{" "}
                    {preset.parameters.maxTokens}
                  </div>
                  <div>
                    <span className="text-[var(--text-secondary)]">Top P:</span>{" "}
                    {preset.parameters.topP}
                  </div>
                  <div>
                    <span className="text-[var(--text-secondary)]">Top K:</span>{" "}
                    {preset.parameters.topK}
                  </div>
                  <div>
                    <span className="text-[var(--text-secondary)]">
                      Repeat:
                    </span>{" "}
                    {preset.parameters.repeatPenalty}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
