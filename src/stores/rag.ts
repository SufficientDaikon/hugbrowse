import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  indexDocument,
  removeDocumentIndex,
  readFileAsText,
} from "../lib/rag-engine";

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
  /** FR-032: Attach and index a file for a session */
  attachFile: (sessionId: string, file: File) => Promise<string>;
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

      /** FR-032: Attach and index a file */
      attachFile: async (sessionId, file) => {
        // EC-014: Reject empty files
        if (file.size === 0) {
          const id = crypto.randomUUID();
          set((s) => ({
            documents: [
              ...s.documents,
              {
                id,
                sessionId,
                filename: file.name,
                fileType: file.type || "text/plain",
                fileSize: 0,
                status: "error" as const,
                chunkCount: 0,
                error: "Cannot index an empty document",
                addedAt: Date.now(),
              },
            ],
          }));
          return id;
        }

        const id = crypto.randomUUID();
        set((s) => ({
          documents: [
            ...s.documents,
            {
              id,
              sessionId,
              filename: file.name,
              fileType: file.type || "text/plain",
              fileSize: file.size,
              status: "indexing" as const,
              chunkCount: 0,
              addedAt: Date.now(),
            },
          ],
        }));

        try {
          const text = await readFileAsText(file);
          // EC-016: Large docs — index in next microtask to avoid UI blocking
          await new Promise<void>((resolve, reject) => {
            setTimeout(() => {
              try {
                const chunkCount = indexDocument(id, text);
                get().updateDocument(id, { status: "indexed", chunkCount });
                resolve();
              } catch (e) {
                reject(e);
              }
            }, 0);
          });
        } catch (err) {
          get().updateDocument(id, {
            status: "error",
            error: (err as Error).message,
          });
        }
        return id;
      },

      removeDocument: (id) => {
        removeDocumentIndex(id);
        set((s) => ({ documents: s.documents.filter((d) => d.id !== id) }));
      },

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
