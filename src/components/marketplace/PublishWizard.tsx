/** FR-090: Publish content wizard / FR-095: Creator profile */
import { useState } from "react";
import { Upload, Package, Brain, Puzzle, Workflow, X, Check, AlertCircle } from "lucide-react";
import type { ContentCategory } from "../../lib/marketplace/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES: { id: ContentCategory; label: string; icon: React.ReactNode; description: string }[] = [
  { id: "models", label: "Model", icon: <Brain className="h-5 w-5" />, description: "Share a quantized model with the community" },
  { id: "plugins", label: "Plugin", icon: <Puzzle className="h-5 w-5" />, description: "Extend HugBrowse with custom functionality" },
  { id: "mcp-servers", label: "MCP Server", icon: <Package className="h-5 w-5" />, description: "Share an MCP server configuration" },
  { id: "workflows", label: "Workflow", icon: <Workflow className="h-5 w-5" />, description: "Share a multi-step AI workflow" },
  { id: "skills", label: "Skill", icon: <Upload className="h-5 w-5" />, description: "Share a reusable AI skill prompt" },
];

type Step = "category" | "details" | "files" | "review";

export function PublishWizard({ isOpen, onClose }: Props) {
  const [step, setStep] = useState<Step>("category");
  const [category, setCategory] = useState<ContentCategory | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    version: "1.0.0",
    license: "MIT",
    tags: "",
  });
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  if (!isOpen) return null;

  const handlePublish = async () => {
    setPublishing(true);
    // FR-090: Would submit to community registry
    await new Promise((r) => setTimeout(r, 1500));
    setPublished(true);
    setPublishing(false);
  };

  const reset = () => {
    setStep("category");
    setCategory(null);
    setFormData({ name: "", description: "", version: "1.0.0", license: "MIT", tags: "" });
    setPublished(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={reset}>
      <div
        className="max-w-xl w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-accent" />
            <h2 className="text-sm font-semibold">Publish to Community</h2>
          </div>
          <button onClick={reset} className="text-[var(--muted)] hover:text-[var(--foreground)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex gap-1 px-4 py-2 bg-[var(--background)]">
          {(["category", "details", "files", "review"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div className={`h-1 flex-1 rounded-full transition-colors ${
                (["category", "details", "files", "review"].indexOf(step) >= i) ? "bg-accent" : "bg-[var(--border)]"
              }`} />
            </div>
          ))}
        </div>

        <div className="p-4">
          {published ? (
            <div className="text-center py-8">
              <Check className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-1">Published!</h3>
              <p className="text-sm text-[var(--muted)]">
                Your {category} is now available in the community marketplace.
              </p>
              <button onClick={reset} className="mt-4 px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium">
                Done
              </button>
            </div>
          ) : step === "category" ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold mb-3">What are you publishing?</h3>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => { setCategory(cat.id); setStep("details"); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] hover:border-accent/30 text-left transition-colors"
                >
                  <div className="text-accent">{cat.icon}</div>
                  <div>
                    <h4 className="text-sm font-medium">{cat.label}</h4>
                    <p className="text-[10px] text-[var(--muted)]">{cat.description}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : step === "details" ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Details</h3>
              <input
                type="text"
                placeholder="Name"
                value={formData.name}
                onChange={(e) => setFormData((s) => ({ ...s, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <textarea
                placeholder="Description (supports Markdown)"
                value={formData.description}
                onChange={(e) => setFormData((s) => ({ ...s, description: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm resize-none focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Version"
                  value={formData.version}
                  onChange={(e) => setFormData((s) => ({ ...s, version: e.target.value }))}
                  className="w-24 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <input
                  type="text"
                  placeholder="License"
                  value={formData.license}
                  onChange={(e) => setFormData((s) => ({ ...s, license: e.target.value }))}
                  className="w-24 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <input
                  type="text"
                  placeholder="Tags (comma separated)"
                  value={formData.tags}
                  onChange={(e) => setFormData((s) => ({ ...s, tags: e.target.value }))}
                  className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setStep("category")} className="px-3 py-1.5 text-xs text-[var(--muted)]">Back</button>
                <button
                  onClick={() => setStep("files")}
                  disabled={!formData.name}
                  className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-medium disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          ) : step === "files" ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Upload Files</h3>
              <div className="border-2 border-dashed border-[var(--border)] rounded-xl p-8 text-center hover:border-accent/30 transition-colors">
                <Upload className="h-8 w-8 text-[var(--muted)] mx-auto mb-2" />
                <p className="text-xs text-[var(--muted)]">
                  Drag & drop files here, or click to browse
                </p>
                <p className="text-[10px] text-[var(--muted)] mt-1">
                  {category === "models" ? "GGUF files up to 20GB" :
                   category === "plugins" ? "ZIP archive with manifest.json" :
                   "JSON configuration file"}
                </p>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-[var(--muted)]">
                  SC-021: All uploads are scanned for malicious content before publishing.
                  Your content will be reviewed within 24 hours.
                </p>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setStep("details")} className="px-3 py-1.5 text-xs text-[var(--muted)]">Back</button>
                <button
                  onClick={() => setStep("review")}
                  className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-medium"
                >
                  Next
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Review & Publish</h3>
              <div className="rounded-xl border border-[var(--border)] p-3 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-[var(--muted)]">Type</span><span className="capitalize">{category}</span></div>
                <div className="flex justify-between"><span className="text-[var(--muted)]">Name</span><span>{formData.name}</span></div>
                <div className="flex justify-between"><span className="text-[var(--muted)]">Version</span><span>{formData.version}</span></div>
                <div className="flex justify-between"><span className="text-[var(--muted)]">License</span><span>{formData.license}</span></div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setStep("files")} className="px-3 py-1.5 text-xs text-[var(--muted)]">Back</button>
                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-medium disabled:opacity-50"
                >
                  {publishing ? "Publishing..." : "Publish"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
