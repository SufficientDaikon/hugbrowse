import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  X,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Cloud,
  Eye,
  EyeOff,
} from "lucide-react";
import type { ComputeBackend } from "../../stores/backends";

interface Props {
  modelId: string;
  open: boolean;
  onClose: () => void;
}

const INSTANCE_OPTIONS = [
  {
    value: "nvidia-t4-x1",
    label: "nvidia-t4-x1 ($0.50/hr) - Budget",
    costPerHour: 0.5,
  },
  {
    value: "nvidia-a10g-x1",
    label: "nvidia-a10g-x1 ($1.30/hr) - Balanced",
    costPerHour: 1.3,
  },
  {
    value: "nvidia-a100-x1",
    label: "nvidia-a100-x1 ($6.50/hr) - Performance",
    costPerHour: 6.5,
  },
];

const REGION_OPTIONS = [
  { value: "us-east-1", label: "us-east-1 (US East)" },
  { value: "eu-west-1", label: "eu-west-1 (EU West)" },
  { value: "ap-southeast-1", label: "ap-southeast-1 (Asia Pacific)" },
];

type DeployState = "idle" | "deploying" | "success" | "error";

export function DeployToCloudDialog({ modelId, open, onClose }: Props) {
  const [formData, setFormData] = useState({
    instanceType: "nvidia-a10g-x1",
    region: "us-east-1",
    hfToken: "",
  });
  const [showToken, setShowToken] = useState(false);
  const [deployState, setDeployState] = useState<DeployState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [_deployedBackend, setDeployedBackend] = useState<ComputeBackend | null>(
    null,
  );

  const handleClose = () => {
    setFormData({
      instanceType: "nvidia-a10g-x1",
      region: "us-east-1",
      hfToken: "",
    });
    setShowToken(false);
    setDeployState("idle");
    setErrorMessage("");
    setDeployedBackend(null);
    onClose();
  };

  const handleDeploy = async () => {
    if (!formData.hfToken.trim()) {
      setErrorMessage("HuggingFace token is required");
      return;
    }

    setDeployState("deploying");
    setErrorMessage("");

    try {
      const backend = await invoke<ComputeBackend>("deploy_hf_endpoint", {
        modelId,
        instanceType: formData.instanceType,
        region: formData.region,
        hfToken: formData.hfToken.trim(),
      });

      setDeployedBackend(backend);
      setDeployState("success");
    } catch (error) {
      setErrorMessage(error as string);
      setDeployState("error");
    }
  };

  const selectedInstance = INSTANCE_OPTIONS.find(
    (opt) => opt.value === formData.instanceType,
  );
  const estimatedCostPerDay = selectedInstance
    ? (selectedInstance.costPerHour * 24).toFixed(2)
    : "0";
  const estimatedCostPerMonth = selectedInstance
    ? (selectedInstance.costPerHour * 24 * 30).toFixed(0)
    : "0";

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)] flex items-center gap-2">
            <Cloud className="h-5 w-5 text-blue-500" />
            Deploy to Cloud ☁️
          </h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* Model ID Display */}
          <div>
            <label className="block text-sm font-medium text-[var(--muted)] mb-2">
              Model
            </label>
            <div className="rounded-xl bg-[var(--surface-hover)] px-3 py-2.5 text-sm text-[var(--foreground)] font-mono">
              {modelId}
            </div>
          </div>

          {/* Instance Type Selector */}
          <div>
            <label className="block text-sm font-medium text-[var(--muted)] mb-2">
              Instance Type
            </label>
            <select
              value={formData.instanceType}
              onChange={(e) =>
                setFormData({ ...formData, instanceType: e.target.value })
              }
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              disabled={deployState === "deploying"}
            >
              {INSTANCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Region Selector */}
          <div>
            <label className="block text-sm font-medium text-[var(--muted)] mb-2">
              Region
            </label>
            <select
              value={formData.region}
              onChange={(e) =>
                setFormData({ ...formData, region: e.target.value })
              }
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              disabled={deployState === "deploying"}
            >
              {REGION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* HF Token Input */}
          <div>
            <label className="block text-sm font-medium text-[var(--muted)] mb-2">
              HuggingFace Token
            </label>
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                value={formData.hfToken}
                onChange={(e) =>
                  setFormData({ ...formData, hfToken: e.target.value })
                }
                placeholder="hf_..."
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 pr-10 text-sm text-[var(--foreground)] placeholder-[var(--muted)] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                disabled={deployState === "deploying"}
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                {showToken ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Cost Estimate */}
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
            <div className="text-sm text-amber-600 dark:text-amber-400 font-medium mb-1">
              Estimated Cost
            </div>
            <div className="text-xs text-amber-600/80 dark:text-amber-400/80">
              ~${estimatedCostPerDay}/day • ~${estimatedCostPerMonth}/month
            </div>
          </div>

          {/* Deploy State Messages */}
          {deployState === "success" && (
            <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-3 flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <div className="text-sm">
                <div className="text-green-600 dark:text-green-400 font-medium mb-1">
                  Endpoint deploying...
                </div>
                <div className="text-green-600/80 dark:text-green-400/80">
                  This may take 5-10 minutes. Check status in Backend Settings.
                </div>
              </div>
            </div>
          )}

          {deployState === "error" && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <div className="text-sm">
                <div className="text-red-600 dark:text-red-400 font-medium mb-1">
                  Deployment Failed
                </div>
                <div className="text-red-600/80 dark:text-red-400/80">
                  {errorMessage}
                </div>
              </div>
            </div>
          )}

          {/* Deploy Button */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
              disabled={deployState === "deploying"}
            >
              {deployState === "success" ? "Close" : "Cancel"}
            </button>

            {deployState !== "success" && (
              <button
                onClick={handleDeploy}
                disabled={
                  deployState === "deploying" || !formData.hfToken.trim()
                }
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {deployState === "deploying" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deploying...
                  </>
                ) : (
                  <>
                    <Cloud className="h-4 w-4" />
                    Deploy
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
