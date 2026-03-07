/** FR-063: Keyboard shortcut reference sheet */
import { useEffect, useState } from "react";
import { X, Keyboard } from "lucide-react";

const SHORTCUTS = [
  { category: "Navigation", items: [
    { keys: ["Ctrl", "/"], description: "Toggle shortcut reference" },
    { keys: ["Ctrl", "K"], description: "Quick search" },
    { keys: ["Ctrl", "1"], description: "Go to Search" },
    { keys: ["Ctrl", "2"], description: "Go to Chat" },
    { keys: ["Ctrl", "3"], description: "Go to Marketplace" },
    { keys: ["Ctrl", "4"], description: "Go to Settings" },
  ]},
  { category: "Chat", items: [
    { keys: ["Enter"], description: "Send message" },
    { keys: ["Shift", "Enter"], description: "New line" },
    { keys: ["Escape"], description: "Stop generation" },
    { keys: ["Ctrl", "N"], description: "New chat session" },
  ]},
  { category: "General", items: [
    { keys: ["Ctrl", ","], description: "Open settings" },
    { keys: ["F11"], description: "Toggle fullscreen" },
    { keys: ["Ctrl", "Q"], description: "Quit app" },
  ]},
];

export function KeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4" onClick={() => setIsOpen(false)}>
      <div className="max-w-lg w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-accent" />
            <h2 className="text-sm font-semibold">Keyboard Shortcuts</h2>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-[var(--muted)] hover:text-[var(--foreground)]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
          {SHORTCUTS.map((section) => (
            <div key={section.category}>
              <h3 className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
                {section.category}
              </h3>
              <div className="space-y-1.5">
                {section.items.map((item) => (
                  <div key={item.description} className="flex items-center justify-between">
                    <span className="text-xs text-[var(--muted)]">{item.description}</span>
                    <div className="flex gap-1">
                      {item.keys.map((key) => (
                        <kbd key={key} className="px-1.5 py-0.5 rounded bg-[var(--background)] border border-[var(--border)] text-[10px] font-mono text-[var(--foreground)]">
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
