import { useEffect, useState } from "react";
import type { ResourceAlert } from "../../lib/hf-types";
import { X, AlertTriangle } from "lucide-react";

interface AlertToastProps {
  alert: ResourceAlert;
  onDismiss: (type: string) => void;
}

export function AlertToast({ alert, onDismiss }: AlertToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(alert.type), 300);
    }, 15000);
    return () => clearTimeout(timer);
  }, [alert.type, onDismiss]);

  const bgColor =
    alert.type === "ram"
      ? "bg-yellow-500/10 border-yellow-500/30"
      : alert.type === "vram"
        ? "bg-red-500/10 border-red-500/30"
        : "bg-orange-500/10 border-orange-500/30";

  const iconColor =
    alert.type === "ram"
      ? "text-yellow-500"
      : alert.type === "vram"
        ? "text-red-500"
        : "text-orange-500";

  return (
    <div
      className={`
        fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border p-4 shadow-lg
        backdrop-blur-sm transition-all duration-300
        ${bgColor}
        ${visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}
      `}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className={`h-5 w-5 flex-shrink-0 mt-0.5 ${iconColor}`}
        />
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--foreground)]">
            ⚠️ {alert.type.toUpperCase()} Alert
          </p>
          <p className="text-xs text-[var(--muted)] mt-1">{alert.message}</p>
        </div>
        <button
          onClick={() => onDismiss(alert.type)}
          className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
