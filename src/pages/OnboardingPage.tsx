import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "../stores/settings";
import { useTier } from "../hooks/useTier";
import {
  ArrowRight,
  Check,
  Search,
  Download,
  MessageSquare,
  Cpu,
} from "lucide-react";

const STEPS = [
  { label: "Hardware", icon: Cpu, title: "Welcome to HugBrowse", emoji: null },
  {
    label: "Browse",
    icon: Search,
    title: "Find Your First Model",
    emoji: null,
  },
  {
    label: "Download",
    icon: Download,
    title: "Download a GGUF File",
    emoji: null,
  },
  { label: "Chat", icon: MessageSquare, title: "Load and Chat!", emoji: null },
] as const;

export function OnboardingPage() {
  const navigate = useNavigate();
  const { data: tierInfo } = useTier();
  const setOnboardingComplete = useSettings((s) => s.setOnboardingComplete);
  const [step, setStep] = useState<number>(0);

  const finish = () => {
    setOnboardingComplete(true);
    navigate("/");
  };

  const currentStep = STEPS[step];

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-[var(--background)] p-8">
      {/* Progress steps */}
      <div className="flex items-center gap-1 mb-16">
        {STEPS.map((s, i) => {
          const StepIcon = s.icon;
          return (
            <div key={s.label} className="flex items-center gap-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold transition-all duration-300 ${
                  i < step
                    ? "bg-can-run dark:bg-can-run-light text-white shadow-sm"
                    : i === step
                      ? "bg-gradient-to-br from-hf-orange to-orange-600 text-white shadow-md shadow-hf-orange/20"
                      : "bg-[var(--surface-hover)] text-[var(--muted)]"
                }`}
              >
                {i < step ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <StepIcon className="h-3.5 w-3.5" />
                )}
              </div>
              <span
                className={`text-xs font-medium transition-colors ${
                  i === step
                    ? "text-[var(--foreground)]"
                    : "text-[var(--muted)]"
                }`}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-8 h-0.5 mx-1 rounded-full transition-colors ${
                    i < step
                      ? "bg-can-run/30 dark:bg-can-run-light/30"
                      : "bg-[var(--border)]"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="w-full max-w-md text-center space-y-5">
        {/* Step icon */}
        <div className="flex justify-center">
          <div
            className={`flex h-20 w-20 items-center justify-center rounded-2xl transition-all duration-300 ${
              step === 0
                ? "bg-gradient-to-br from-hf-orange/20 to-orange-500/10"
                : step === 1
                  ? "bg-gradient-to-br from-accent/20 to-purple-500/10"
                  : step === 2
                    ? "bg-gradient-to-br from-can-run/20 to-emerald-500/10"
                    : "bg-gradient-to-br from-hf-orange/20 to-accent/10"
            }`}
          >
            {(() => {
              const Icon = currentStep.icon;
              return <Icon className="h-9 w-9 text-[var(--foreground)]" />;
            })()}
          </div>
        </div>

        <h2 className="text-2xl font-bold">{currentStep.title}</h2>

        {step === 0 && (
          <div className="space-y-3">
            <p className="text-[var(--muted)] leading-relaxed">
              We detected your hardware tier:{" "}
              <strong className="text-[var(--foreground)]">
                {tierInfo?.name ?? "detecting…"}
              </strong>
            </p>
            <p className="text-sm text-[var(--muted)]">
              {tierInfo?.description}
            </p>
          </div>
        )}
        {step === 1 && (
          <p className="text-[var(--muted)] leading-relaxed">
            Search for GGUF models on the main page. Filter by your hardware
            tier to see compatible models.
          </p>
        )}
        {step === 2 && (
          <p className="text-[var(--muted)] leading-relaxed">
            On any model's detail page, open the{" "}
            <strong className="text-[var(--foreground)]">Files</strong> tab and
            click <strong className="text-[var(--foreground)]">Download</strong>{" "}
            on a GGUF variant.
          </p>
        )}
        {step === 3 && (
          <p className="text-[var(--muted)] leading-relaxed">
            Go to <strong className="text-[var(--foreground)]">Chat</strong>,
            load your downloaded model, and start a conversation.
          </p>
        )}

        <div className="flex justify-center gap-3 pt-6">
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-hf-orange to-orange-600 px-7 py-3 font-semibold text-white hover:opacity-90 transition-all shadow-md shadow-hf-orange/20"
            >
              Next <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={finish}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-can-run to-emerald-600 dark:from-can-run-light dark:to-emerald-400 px-7 py-3 font-semibold text-white dark:text-gray-900 hover:opacity-90 transition-all shadow-md shadow-can-run/20"
            >
              <Check className="h-4 w-4" /> Let's go!
            </button>
          )}
          <button
            onClick={finish}
            className="rounded-xl border border-[var(--border)] px-6 py-3 text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-all"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
