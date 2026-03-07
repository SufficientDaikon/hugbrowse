import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface RagDocument {
  id: string;
  sessionId: string;
  filename: string;
  fileType: string;
  fileSize: number;
  status: "indexing" | "indexed" | "error";
  chunkCount: number;
  error?: string;
  addedAt: number;
}

interface RagStore {
  documents: RagDocument[];
  addDocument: (doc: Omit<RagDocument, "id" | "addedAt">) => string;
  removeDocument: (id: string) => void;
  updateDocument: (id: string, patch: Partial<RagDocument>) => void;
  getSessionDocs: (sessionId: string) => RagDocument[];
}

export const useRag = create<RagStore>()(
  persist(
    (set, get) => ({
      documents: [],

      addDocument: (doc) => {
        // EC-014: Reject empty documents
        if (doc.fileSize === 0) {
          const id = crypto.randomUUID();
          set((s) => ({
            documents: [
              ...s.documents,
              {
                ...doc,
                id,
                addedAt: Date.now(),
                status: "error" as const,
                error: "Cannot index an empty document",
                chunkCount: 0,
              },
            ],
          }));
          return id;
        }
        const id = crypto.randomUUID();
        set((s) => ({
          documents: [...s.documents, { ...doc, id, addedAt: Date.now() }],
        }));
        return id;
      },

      removeDocument: (id) =>
        set((s) => ({ documents: s.documents.filter((d) => d.id !== id) })),

      updateDocument: (id, patch) =>
        set((s) => ({
          documents: s.documents.map((d) =>
            d.id === id ? { ...d, ...patch } : d,
          ),
        })),

      getSessionDocs: (sessionId) =>
        get().documents.filter((d) => d.sessionId === sessionId),
    }),
    { name: "hugbrowse-rag" },
  ),
);
