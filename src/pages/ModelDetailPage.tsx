import { useParams, useNavigate } from "react-router-dom";
import {
  useModelDetail,
  useModelReadme,
  useModelFiles,
} from "../hooks/useModelDetail";
import { CanItRun } from "../components/compatibility/CanItRun";
import { Badge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/Skeleton";
import { InfoButton } from "../components/explain/ExplainText";
import { DownloadPanel } from "../components/download/DownloadPanel";
import { useDownloads } from "../stores/downloads";
import {
  formatNumber,
  formatBytes,
  estimateModelParams,
} from "../lib/compatibility";
import {
  ArrowLeft,
  Download,
  Heart,
  Calendar,
  ExternalLink,
  Copy,
  Check,
  FileText,
  Code,
  FolderOpen,
} from "lucide-react";
import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { appLocalDataDir } from "@tauri-apps/api/path";

type Tab = "readme" | "files" | "usage";

export function ModelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const modelId = decodeURIComponent(id || "");

  const { data: model, isLoading } = useModelDetail(modelId);
  const { data: readme } = useModelReadme(modelId);
  const { data: files } = useModelFiles(modelId);
  const [tab, setTab] = useState<Tab>("readme");
  const [copied, setCopied] = useState(false);
  const { startDownload, downloads, init: initDownloads } = useDownloads();

  useEffect(() => {
    initDownloads();
  }, [initDownloads]);

  const handleDownloadGguf = async (
    rfilename: string,
    sizeBytes: number,
    sha256?: string,
  ) => {
    try {
      const destDir = await appLocalDataDir()
        .then((d) => `${d}models/${modelId}`)
        .catch(() => `models/${modelId}`);
      const url = `https://huggingface.co/${modelId}/resolve/main/${rfilename}`;
      await startDownload({
        url,
        model_id: modelId,
        filename: rfilename,
        dest_dir: destDir,
        total_bytes: sizeBytes,
        expected_sha256: sha256,
      });
    } catch (e) {
      console.error("Download failed:", e);
    }
  };

  const isAlreadyDownloaded = (filename: string) =>
    Object.values(downloads).some(
      (d) =>
        d.model_id === modelId &&
        d.filename === filename &&
        (d.status === "complete" ||
          d.status === "downloading" ||
          d.status === "paused"),
    );

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!model) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-hover)] mb-4">
          <ArrowLeft className="h-7 w-7 text-[var(--muted)]" />
        </div>
        <h2 className="text-base font-semibold mb-1">Model not found</h2>
        <button
          onClick={() => navigate("/")}
          className="text-accent dark:text-accent-light hover:underline text-sm mt-2"
        >
          ← Back to search
        </button>
      </div>
    );
  }

  const author = model.id.split("/")[0];
  const name = model.id.split("/").slice(1).join("/");
  const params = estimateModelParams(model);

  const copySnippet = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const pythonSnippet = `from transformers import pipeline

pipe = pipeline("${model.pipeline_tag || "text-generation"}", model="${model.id}")
result = pipe("Hello, world!")
print(result)`;

  const cliSnippet = `# Install transformers
pip install transformers

# Download model
huggingface-cli download ${model.id}`;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "readme", label: "README", icon: <FileText className="h-4 w-4" /> },
    { id: "files", label: "Files", icon: <FolderOpen className="h-4 w-4" /> },
    { id: "usage", label: "Usage", icon: <Code className="h-4 w-4" /> },
  ];

  return (
    <div className="p-6 max-w-5xl">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)] mb-5 transition-colors group"
      >
        <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" /> Back
      </button>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-[var(--muted)] font-medium uppercase tracking-wide">{author}</p>
            <h1 className="text-2xl font-bold text-[var(--foreground)] mt-0.5">
              {name || model.id}
            </h1>
          </div>
          <a
            href={`https://huggingface.co/${model.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3.5 py-2 text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--muted)] transition-all shrink-0"
          >
            <ExternalLink className="h-3.5 w-3.5" /> View on HF
          </a>
        </div>

        {/* Tags & Stats */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {model.pipeline_tag && (
            <Badge variant="orange">{model.pipeline_tag}</Badge>
          )}
          {model.library_name && (
            <Badge variant="outline">{model.library_name}</Badge>
          )}
          {params && (
            <Badge variant="default">
              {params >= 1 ? `${params}B` : `${Math.round(params * 1000)}M`}{" "}
              params
              <InfoButton term="Parameters" />
            </Badge>
          )}
          {model.tags?.includes("gguf") && (
            <Badge variant="default">
              GGUF <InfoButton term="GGUF" />
            </Badge>
          )}
          <span className="flex items-center gap-1 text-sm text-[var(--muted)]">
            <Download className="h-3.5 w-3.5" /> {formatNumber(model.downloads)}
          </span>
          <span className="flex items-center gap-1 text-sm text-[var(--muted)]">
            <Heart className="h-3.5 w-3.5" /> {formatNumber(model.likes)}
          </span>
          {model.lastModified && (
            <span className="flex items-center gap-1 text-sm text-[var(--muted)]">
              <Calendar className="h-3.5 w-3.5" />{" "}
              {new Date(model.lastModified).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {/* Can It Run Panel */}
      <div className="mb-6">
        <CanItRun model={model} />
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--border)] mb-6">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? "border-hf-orange text-hf-orange"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {t.icon} {t.label}
              {t.id === "files" && files && (
                <span className="ml-1 text-xs text-[var(--muted-foreground)]">
                  ({files.length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {tab === "readme" && (
        <div className="prose prose-sm dark:prose-invert max-w-none rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 overflow-hidden">
          {readme ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{readme}</ReactMarkdown>
          ) : (
            <p className="text-[var(--muted)]">
              No README available for this model.
            </p>
          )}
        </div>
      )}

      {tab === "files" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            {files && files.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--background)]">
                    <th className="px-4 py-2 text-left font-medium text-[var(--muted)]">
                      File
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-[var(--muted)]">
                      Size
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-[var(--muted)]">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file, i) => {
                    const sizeBytes = file.lfs?.size ?? file.size ?? 0;
                    const isGguf = file.rfilename
                      .toLowerCase()
                      .endsWith(".gguf");
                    const alreadyQueued = isAlreadyDownloaded(file.rfilename);
                    return (
                      <tr
                        key={i}
                        className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)]"
                      >
                        <td className="px-4 py-2 font-mono text-xs text-[var(--foreground)]">
                          {file.rfilename}
                          {isGguf && (
                            <Badge
                              variant="default"
                              className="ml-2 text-[10px]"
                            >
                              GGUF
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right text-xs text-[var(--muted)]">
                          {sizeBytes ? formatBytes(sizeBytes) : "—"}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {isGguf && (
                            <button
                              disabled={alreadyQueued}
                              onClick={() =>
                                handleDownloadGguf(
                                  file.rfilename,
                                  sizeBytes,
                                  file.lfs?.sha256,
                                )
                              }
                              className="flex items-center gap-1 ml-auto rounded-lg border border-hf-orange/40 bg-hf-orange/10 px-2.5 py-1 text-xs font-medium text-hf-orange hover:bg-hf-orange/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              <Download className="h-3 w-3" />
                              {alreadyQueued ? "Queued" : "Download"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="p-6 text-sm text-[var(--muted)]">No files found.</p>
            )}
          </div>
          <DownloadPanel />
        </div>
      )}

      {tab === "usage" && (
        <div className="space-y-4">
          {/* Python */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2 bg-[var(--background)]">
              <span className="text-sm font-medium text-[var(--foreground)]">
                🐍 Python
              </span>
              <button
                onClick={() => copySnippet(pythonSnippet)}
                className="flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                {copied ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="p-4 text-sm font-mono text-[var(--foreground)] overflow-x-auto">
              <code>{pythonSnippet}</code>
            </pre>
          </div>

          {/* CLI */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2 bg-[var(--background)]">
              <span className="text-sm font-medium text-[var(--foreground)]">
                💻 CLI
              </span>
              <button
                onClick={() => copySnippet(cliSnippet)}
                className="flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                {copied ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="p-4 text-sm font-mono text-[var(--foreground)] overflow-x-auto">
              <code>{cliSnippet}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
