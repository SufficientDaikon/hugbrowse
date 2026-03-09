import {
  Search,
  Settings,
  Sun,
  Moon,
  Monitor,
  Sparkles,
  Activity,
  MessageSquare,
  Store,
  Users,
  X,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSettings } from "../../stores/settings";
import { useSearchStore } from "../../stores/search";
import { cn } from "../ui/cn";
import { useEffect, useRef } from "react";
import { TierBadge } from "../tier/TierBadge";
import { useTier } from "../../hooks/useTier";

const NAV_ITEMS = [
  { path: "/chat", icon: MessageSquare, label: "Chat", soon: false },
  { path: "/recommended", icon: Sparkles, label: "For You", soon: false },
  { path: "/monitor", icon: Activity, label: "Monitor", soon: false },
  { path: "/marketplace", icon: Store, label: "Marketplace", soon: true },
  { path: "/community", icon: Users, label: "Community", soon: true },
] as const;

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
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-[var(--border-subtle)] glass-heavy px-5">
      {/* Logo */}
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-2.5 hover:opacity-80 transition-opacity shrink-0"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-hf-orange to-orange-600 shadow-sm">
          <span className="text-base leading-none">🤗</span>
        </div>
        <span className="text-[15px] font-bold tracking-tight text-gradient hidden sm:inline">
          HugBrowse
        </span>
      </button>

      {/* Search */}
      <div className="relative flex-1 max-w-xl mx-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search models… ⌘K"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className={cn(
            "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-inset)] py-2.5 pl-10 pr-10 text-sm",
            "placeholder:text-[var(--muted-foreground)]",
            "focus:outline-none focus:ring-2 focus:ring-hf-orange/30 focus:border-hf-orange/30 focus:shadow-[var(--shadow-orange-glow)]",
            "transition-all duration-200 ease-smooth",
          )}
        />
        {query && (
          <button
            onClick={() => handleSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex items-center gap-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-150",
                isActive
                  ? "bg-hf-orange/10 text-hf-orange dark:text-hf-orange-light"
                  : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
              )}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
              {item.soon && (
                <span className="text-[8px] px-1 py-px rounded bg-[var(--muted-foreground)]/15 text-[var(--muted)] font-semibold leading-none uppercase">
                  soon
                </span>
              )}
            </button>
          );
        })}

        <div className="hidden sm:block w-px h-5 bg-[var(--border)] mx-1.5" />

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
              "bg-hf-orange/10 text-hf-orange dark:text-hf-orange-light",
          )}
        >
          <Settings className="h-4 w-4" />
        </button>
      </nav>
    </header>
  );
}
