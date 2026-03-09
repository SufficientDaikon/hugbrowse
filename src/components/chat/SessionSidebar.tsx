import { useState } from "react";
import { useChatStore } from "../../stores/chat";
import { Plus, MessageSquare, Pencil, Trash2, Check, X } from "lucide-react";
import { cn } from "../ui/cn";

export function SessionSidebar() {
  const {
    sessions,
    currentSessionId,
    createSession,
    deleteSession,
    renameSession,
    setCurrentSession,
  } = useChatStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const startEdit = (id: string, title: string) => {
    setEditingId(id);
    setEditTitle(title);
  };

  const commitEdit = () => {
    if (editingId && editTitle.trim()) {
      renameSession(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-[var(--border-subtle)] bg-[var(--surface)]">
      <div className="p-3 border-b border-[var(--border-subtle)]">
        <button
          onClick={() => createSession()}
          className="w-full flex items-center gap-2 rounded-lg bg-hf-orange/10 text-hf-orange hover:bg-hf-orange/20 px-3 py-2 text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" /> New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {sessions.length === 0 && (
          <p className="text-xs text-[var(--muted)] text-center py-4">
            No sessions yet
          </p>
        )}
        {sessions.map((session) => (
          <div
            key={session.id}
            className={cn(
              "group relative flex items-center gap-2 rounded-lg px-2 py-2 cursor-pointer transition-colors",
              session.id === currentSessionId
                ? "bg-hf-orange/10 text-hf-orange dark:text-hf-orange-light"
                : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
            )}
            onClick={() => setCurrentSession(session.id)}
          >
            <MessageSquare className="h-3.5 w-3.5 shrink-0" />
            {editingId === session.id ? (
              <input
                autoFocus
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEdit();
                  if (e.key === "Escape") setEditingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 min-w-0 bg-transparent text-xs outline-none border-b border-hf-orange"
              />
            ) : (
              <span className="flex-1 truncate text-xs">{session.title}</span>
            )}

            {editingId === session.id ? (
              <div
                className="flex items-center gap-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={commitEdit}
                  className="p-0.5 text-green-500 hover:text-green-600"
                >
                  <Check className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="p-0.5 text-[var(--muted)] hover:text-[var(--foreground)]"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div
                className="hidden group-hover:flex items-center gap-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => startEdit(session.id, session.title)}
                  className="p-0.5 text-[var(--muted)] hover:text-[var(--foreground)]"
                  title="Rename"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={() => deleteSession(session.id)}
                  className="p-0.5 text-[var(--muted)] hover:text-red-500"
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
