/** FR-057: Privacy and telemetry consent screen */
import { useState } from "react";
import { Shield, BarChart3, AlertTriangle, Users } from "lucide-react";

interface Props {
  onComplete: () => void;
}

interface ConsentState {
  analytics: boolean;
  crashReports: boolean;
  community: boolean;
}

export function PrivacyConsent({ onComplete }: Props) {
  const [consent, setConsent] = useState<ConsentState>({
    analytics: false,
    crashReports: true,
    community: true,
  });

  const handleSave = () => {
    // NFR-022: Save consent choices
    localStorage.setItem("hugbrowse-analytics-consent", String(consent.analytics));
    localStorage.setItem("hugbrowse-crash-consent", String(consent.crashReports));
    localStorage.setItem("hugbrowse-community-consent", String(consent.community));
    localStorage.setItem("hugbrowse-privacy-accepted", "true");
    onComplete();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-[var(--background)]">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center">
          <Shield className="h-12 w-12 text-accent mx-auto mb-3" />
          <h1 className="text-2xl font-bold mb-2">Your Privacy Matters</h1>
          <p className="text-sm text-[var(--muted)]">
            HugBrowse runs AI models locally on your machine. We collect minimal data
            and only with your explicit consent.
          </p>
        </div>

        <div className="space-y-3">
          {/* NFR-024: Clear explanation of each data category */}
          <ConsentToggle
            icon={<BarChart3 className="h-4 w-4" />}
            title="Usage Analytics"
            description="Anonymous app usage patterns (pages visited, features used). No personal data, chat content, or model names."
            checked={consent.analytics}
            onChange={(v) => setConsent((s) => ({ ...s, analytics: v }))}
          />

          <ConsentToggle
            icon={<AlertTriangle className="h-4 w-4" />}
            title="Crash Reports"
            description="Automatic error reports when HugBrowse crashes. Includes error message, stack trace, and hardware tier. No chat history or files."
            checked={consent.crashReports}
            onChange={(v) => setConsent((s) => ({ ...s, crashReports: v }))}
          />

          <ConsentToggle
            icon={<Users className="h-4 w-4" />}
            title="Community Participation"
            description="Allow browsing and installing from the community marketplace. Your HuggingFace username is visible when you publish content."
            checked={consent.community}
            onChange={(v) => setConsent((s) => ({ ...s, community: v }))}
          />
        </div>

        <p className="text-[10px] text-[var(--muted)] text-center">
          You can change these settings anytime in Settings → Privacy.
          We never share your chat history, model files, or documents.
        </p>

        <div className="flex gap-3 justify-center">
          <button
            onClick={() => {
              setConsent({ analytics: false, crashReports: false, community: false });
              handleSave();
            }}
            className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Decline All
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            Save & Continue
          </button>
        </div>
      </div>
    </div>
  );
}

function ConsentToggle({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] cursor-pointer hover:border-accent/30 transition-colors">
      <div className="mt-0.5 text-accent shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-[var(--muted)] mt-0.5 leading-relaxed">{description}</p>
      </div>
      <div className="shrink-0 mt-1">
        <div
          role="switch"
          aria-checked={checked}
          onClick={(e) => { e.preventDefault(); onChange(!checked); }}
          className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
            checked ? "bg-accent" : "bg-[var(--border)]"
          }`}
        >
          <div
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
              checked ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </div>
      </div>
    </label>
  );
}
