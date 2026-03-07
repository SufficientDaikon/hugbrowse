import {
  Search,
  Settings,
  Sun,
  Moon,
  Monitor,
  Sparkles,
  Activity,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSettings } from "../../stores/settings";
import { useSearchStore } from "../../stores/search";
import { cn } from "../ui/cn";
import { useEffect, useRef } from "react";
import { TierBadge } from "../tier/TierBadge";
import { useTier } from "../../hooks/useTier";

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useSettings();
  const { query, setQuery } = useSearchStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: tierInfo } = useTier();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSearch = (value: string) => {
    setQuery(value);
    if (location.pathname !== "/") {
      navigate("/");
    }
  };

  const nextTheme = (): void => {
    const cycle: Record<string, "light" | "dark" | "system"> = {
      system: "light",
      light: "dark",
      dark: "system",
    };
    setTheme(cycle[theme]);
  };

  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-[var(--border)] bg-[var(--surface)]/80 px-4 backdrop-blur-sm">
      {/* Logo */}
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-2 text-lg font-semibold tracking-tight hover:opacity-80 transition-opacity"
      >
        <span className="text-2xl">🤗</span>
        <span className="bg-gradient-to-r from-hf-orange to-accent bg-clip-text text-transparent">
          HugBrowse
        </span>
      </button>

      {/* Search */}
      <div className="relative flex-1 max-w-2xl mx-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search models... (Ctrl+K)"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className={cn(
            "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2 pl-10 pr-4 text-sm",
            "placeholder:text-[var(--muted-foreground)]",
            "focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent",
            "transition-all duration-200",
          )}
        />
        {query && (
          <button
            onClick={() => handleSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            ✕
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Nav links */}
        <button
          onClick={() => navigate("/recommended")}
          className={cn(
            "hidden sm:flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
            location.pathname === "/recommended"
              ? "bg-accent/10 text-accent dark:text-accent-light"
              : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
          For You
        </button>
        <button
          onClick={() => navigate("/monitor")}
          className={cn(
            "hidden sm:flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
            location.pathname === "/monitor"
              ? "bg-accent/10 text-accent dark:text-accent-light"
              : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
          )}
        >
          <Activity className="h-3.5 w-3.5" />
          Monitor
        </button>

        <div className="hidden sm:block w-px h-5 bg-[var(--border)] mx-1" />

        {/* Tier badge */}
        {tierInfo && (
          <button
            onClick={() => navigate("/monitor")}
            className="hidden sm:block"
            title={`Hardware tier: ${tierInfo.name}`}
          >
            <TierBadge tier={tierInfo.tier} />
          </button>
        )}

        <button
          onClick={nextTheme}
          className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-colors"
          title={`Theme: ${theme}`}
        >
          <ThemeIcon className="h-4 w-4" />
        </button>
        <button
          onClick={() => navigate("/settings")}
          className={cn(
            "rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-colors",
            location.pathname === "/settings" &&
              "bg-[var(--surface-hover)] text-[var(--foreground)]",
          )}
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
