import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "../stores/settings";
import { useTier } from "../hooks/useTier";
import { ArrowRight, Check } from "lucide-react";

const STEPS = ["Hardware", "Recommendation", "Download", "Chat"] as const;

export function OnboardingPage() {
  const navigate = useNavigate();
  const { data: tierInfo } = useTier();
  const setOnboardingComplete = useSettings((s) => s.setOnboardingComplete);
  const [step, setStep] = useState<number>(0);

  const finish = () => {
    setOnboardingComplete(true);
    navigate("/");
  };

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-[var(--background)] p-8">
      {/* Progress steps */}
      <div className="flex items-center gap-2 mb-12">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                i < step
                  ? "bg-green-500 text-white"
                  : i === step
                    ? "bg-hf-orange text-white"
                    : "bg-[var(--border)] text-[var(--muted)]"
              }`}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span
              className={`text-sm font-medium ${
                i === step ? "text-[var(--foreground)]" : "text-[var(--muted)]"
              }`}
            >
              {s}
            </span>
            {i < STEPS.length - 1 && (
              <div className="w-8 h-px bg-[var(--border)] mx-1" />
            )}
          </div>
        ))}
      </div>

      <div className="w-full max-w-lg text-center space-y-4">
        {step === 0 && (
          <>
            <div className="text-6xl mb-4">{tierInfo?.icon ?? "🖥️"}</div>
            <h2 className="text-2xl font-bold">Welcome to HugBrowse</h2>
            <p className="text-[var(--muted)]">
              We detected your hardware tier:{" "}
              <strong>{tierInfo?.name ?? "detecting…"}</strong>
            </p>
            <p className="text-sm text-[var(--muted)]">
              {tierInfo?.description}
            </p>
          </>
        )}
        {step === 1 && (
          <>
            <div className="text-6xl mb-4">🤗</div>
            <h2 className="text-2xl font-bold">Find Your First Model</h2>
            <p className="text-[var(--muted)]">
              Search for GGUF models on the main page. Filter by your hardware
              tier to see compatible models.
            </p>
          </>
        )}
        {step === 2 && (
          <>
            <div className="text-6xl mb-4">⬇️</div>
            <h2 className="text-2xl font-bold">Download a GGUF File</h2>
            <p className="text-[var(--muted)]">
              On any model's detail page, open the <strong>Files</strong> tab
              and click <strong>Download</strong> on a GGUF variant.
            </p>
          </>
        )}
        {step === 3 && (
          <>
            <div className="text-6xl mb-4">💬</div>
            <h2 className="text-2xl font-bold">Load and Chat!</h2>
            <p className="text-[var(--muted)]">
              Go to <strong>Chat</strong>, load your downloaded model, and start
              a conversation.
            </p>
          </>
        )}

        <div className="flex justify-center gap-3 pt-4">
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center gap-2 rounded-xl bg-hf-orange px-6 py-3 font-semibold text-white hover:bg-hf-orange/90 transition-colors"
            >
              Next <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={finish}
              className="flex items-center gap-2 rounded-xl bg-green-500 px-6 py-3 font-semibold text-white hover:bg-green-600 transition-colors"
            >
              <Check className="h-4 w-4" /> Let's go!
            </button>
          )}
          <button
            onClick={finish}
            className="rounded-xl border border-[var(--border)] px-6 py-3 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
