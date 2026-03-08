import { useState, useEffect, useRef } from "react";
import { useBackends } from "../../stores/backends";
import {
  Server,
  Globe,
  Cpu,
  ChevronDown,
  Circle,
  Plus,
  Settings,
} from "lucide-react";
import { cn } from "../ui/cn";
import type { BackendType, BackendStatus } from "../../stores/backends";

interface Props {
  className?: string;
}

const TYPE_ICONS = {
  local_sidecar: Cpu,
  hf_endpoint: Globe,
  custom_url: Server,
} as const;

const TYPE_LABELS = {
  local_sidecar: "Local",
  hf_endpoint: "HF",
  custom_url: "Remote",
} as const;

function getStatusColor(status: BackendStatus): string {
  switch (status) {
    case "online":
      return "text-green-500";
    case "offline":
      return "text-red-500";
    case "deploying":
    case "paused":
      return "text-amber-500";
    case "error":
    case "auth_error":
      return "text-red-500";
    case "no_model_loaded":
      return "text-zinc-500";
    default:
      return "text-zinc-500";
  }
}

function getStatusDotColor(status: BackendStatus): string {
  switch (status) {
    case "online":
      return "bg-green-500";
    case "offline":
      return "bg-red-500";
    case "deploying":
    case "paused":
      return "bg-amber-500 animate-pulse";
    case "error":
    case "auth_error":
      return "bg-red-500";
    case "no_model_loaded":
      return "bg-zinc-500";
    default:
      return "bg-zinc-500";
  }
}

export function BackendSelector({ className }: Props) {
  const { backends, activeBackend, setActiveBackend } = useBackends();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectBackend = async (backendId: string) => {
    try {
      await setActiveBackend(backendId);
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to set active backend:", error);
    }
  };

  const Icon = activeBackend ? TYPE_ICONS[activeBackend.backend_type] : Server;

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      {/* Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm hover:bg-[var(--surface-hover)] transition-colors"
      >
        <Icon className="h-4 w-4 text-[var(--muted)]" />
        <span className="font-medium truncate max-w-32">
          {activeBackend?.name || "No Backend"}
        </span>
        {activeBackend && (
          <Circle
            className={cn(
              "h-2 w-2 fill-current",
              getStatusColor(activeBackend.status),
            )}
          />
        )}
        <ChevronDown className="h-3 w-3 text-[var(--muted)] ml-1" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 rounded-lg border border-zinc-700 bg-zinc-800 shadow-lg z-50 overflow-hidden">
          <div className="p-2 space-y-1">
            {backends.length === 0 ? (
              <div className="p-3 text-center text-sm text-zinc-400">
                No backends configured
              </div>
            ) : (
              backends.map((backend) => {
                const IconComponent = TYPE_ICONS[backend.backend_type];
                const isActive = activeBackend?.id === backend.id;

                return (
                  <button
                    key={backend.id}
                    onClick={() => handleSelectBackend(backend.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-md text-left transition-colors",
                      isActive
                        ? "bg-zinc-700 text-zinc-100"
                        : "hover:bg-zinc-750 text-zinc-300 hover:text-zinc-100",
                    )}
                  >
                    <IconComponent className="h-4 w-4 text-zinc-400" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {backend.name}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300">
                          {TYPE_LABELS[backend.backend_type]}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Circle
                          className={cn(
                            "h-2 w-2 fill-current",
                            getStatusDotColor(backend.status),
                          )}
                        />
                        <span className="text-xs text-zinc-400 capitalize">
                          {backend.status.replace("_", " ")}
                        </span>
                        {backend.latency_ms && (
                          <span className="text-xs text-zinc-500">
                            {backend.latency_ms}ms
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-zinc-700 p-2">
            <button
              onClick={() => {
                setIsOpen(false);
                // Navigate to settings - we'll need to handle this via router or callback
                window.location.hash = "#/settings";
              }}
              className="w-full flex items-center gap-2 p-2 rounded-md text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition-colors"
            >
              <Settings className="h-4 w-4" />
              Manage Backends
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
