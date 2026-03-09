import { useState } from "react";
import { useChatStore, type ChatFolder } from "../../stores/chat";
import { Plus, MessageSquare, Pencil, Trash2, Check, X, Search, FolderPlus, Copy, Folder } from "lucide-react";
import { cn } from "../ui/cn";

export function SessionSidebar() {
  const {
    sessions,
    currentSessionId,
    createSession,
    deleteSession,
    renameSession,
    setCurrentSession,
    folders,
    searchQuery,
    setSearchQuery,
    getFilteredSessions,
    createFolder,
    deleteFolder,
    renameFolder,
    duplicateSession,
    moveToFolder,
  } = useChatStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  const filteredSessions = getFilteredSessions();

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

  const handleCreateFolder = () => {
    const id = createFolder("New Folder");
    setEditingFolderId(id);
    setEditFolderName("New Folder");
  };

  const commitFolderEdit = () => {
    if (editingFolderId && editFolderName.trim()) {
      renameFolder(editingFolderId, editFolderName.trim());
    }
    setEditingFolderId(null);
  };

  const toggleFolder = (id: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Group sessions by folder
  const unfolderedSessions = filteredSessions.filter((s) => !s.folderId);
  const folderGroups = (folders ?? []).map((folder: ChatFolder) => ({
    folder,
    sessions: filteredSessions.filter((s) => s.folderId === folder.id),
  }));

  const renderSession = (session: typeof sessions[0]) => (
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
            onClick={() => duplicateSession(session.id)}
            className="p-0.5 text-[var(--muted)] hover:text-[var(--foreground)]"
            title="Duplicate"
          >
            <Copy className="h-3 w-3" />
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
  );

  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-[var(--border-subtle)] bg-[var(--surface)]">
      <div className="p-3 border-b border-[var(--border-subtle)] space-y-2">
        <button
          onClick={() => createSession()}
          className="w-full flex items-center gap-2 rounded-lg bg-hf-orange/10 text-hf-orange hover:bg-hf-orange/20 px-3 py-2 text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" /> New Chat
        </button>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            className="w-full pl-7 pr-2 py-1.5 text-xs rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] outline-none focus:ring-1 focus:ring-[var(--ring)]"
          />
        </div>
        <button
          onClick={handleCreateFolder}
          className="w-full flex items-center gap-2 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] px-3 py-1.5 text-xs transition-colors"
        >
          <FolderPlus className="h-3.5 w-3.5" /> New Folder
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {sessions.length === 0 && (
          <p className="text-xs text-[var(--muted)] text-center py-4">
            No sessions yet
          </p>
        )}

        {/* Folders */}
        {folderGroups.map(({ folder, sessions: folderSessions }) => (
          <div key={folder.id} className="mb-1">
            <div
              className="group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
              onClick={() => toggleFolder(folder.id)}
            >
              <Folder className="h-3 w-3 text-[var(--muted)]" />
              {editingFolderId === folder.id ? (
                <input
                  autoFocus
                  value={editFolderName}
                  onChange={(e) => setEditFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitFolderEdit();
                    if (e.key === "Escape") setEditingFolderId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 min-w-0 bg-transparent text-xs outline-none border-b border-hf-orange"
                />
              ) : (
                <span className="flex-1 text-xs font-medium text-[var(--muted)] truncate">
                  {folder.name}
                </span>
              )}
              <div
                className="hidden group-hover:flex items-center gap-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => { setEditingFolderId(folder.id); setEditFolderName(folder.name); }}
                  className="p-0.5 text-[var(--muted)] hover:text-[var(--foreground)]"
                  title="Rename folder"
                >
                  <Pencil className="h-2.5 w-2.5" />
                </button>
                <button
                  onClick={() => deleteFolder(folder.id)}
                  className="p-0.5 text-[var(--muted)] hover:text-red-500"
                  title="Delete folder"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </div>
            </div>
            {!collapsedFolders.has(folder.id) && (
              <div className="ml-3 space-y-0.5">
                {folderSessions.map(renderSession)}
              </div>
            )}
          </div>
        ))}

        {/* Unfoldered sessions */}
        {unfolderedSessions.map(renderSession)}
      </div>
    </aside>
  );
}
