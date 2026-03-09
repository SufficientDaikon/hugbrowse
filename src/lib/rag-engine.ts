/**
 * RAG Engine — chunking, indexing, and retrieval for local documents.
 * Uses keyword-based (TF-IDF-like) retrieval with the local model for re-ranking.
 * FR-032..FR-036: Document attachment, chunking, embedding, context injection, source citations.
 */

export type ChunkStrategy = 'fixed' | 'sentence' | 'semantic';

export interface RagChunk {
  id: string;
  docId: string;
  text: string;
  index: number;
  tokens: string[];
}

export interface RagConfig {
  chunkStrategy: ChunkStrategy;
  chunkTokens: number;
  overlapTokens: number;
  topK: number;
  embeddingModel: string | null;
}

// In-memory chunk store keyed by docId
const chunkStore = new Map<string, RagChunk[]>();

const STORAGE_KEY = "hugbrowse-rag-chunks";

/** FR-037: Persist chunk index to localStorage */
function persistChunks(): void {
  try {
    const data: Record<string, RagChunk[]> = {};
    for (const [k, v] of chunkStore) data[k] = v;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota exceeded — non-critical */
  }
}

/** FR-037: Restore chunk index from localStorage on import */
function restoreChunks(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as Record<string, RagChunk[]>;
    for (const [k, v] of Object.entries(data)) chunkStore.set(k, v);
  } catch {
    /* parse error — start fresh */
  }
}

// Restore on module load
restoreChunks();

/** Default RAG configuration. */
let ragConfig: RagConfig = {
  chunkStrategy: 'fixed',
  chunkTokens: 512,
  overlapTokens: 64,
  topK: 5,
  embeddingModel: null,
};

/** Update RAG configuration. */
export function setRagConfig(config: Partial<RagConfig>): void {
  ragConfig = { ...ragConfig, ...config };
}

/** Get current RAG configuration. */
export function getRagConfig(): RagConfig {
  return { ...ragConfig };
}

// FR-035: ~4 chars per token
const CHARS_PER_TOKEN = 4;

/**
 * FR-033: Split text into overlapping chunks.
 * Supports strategies: 'fixed' (char-based), 'sentence' (sentence boundary), 'semantic' (paragraph).
 */
export function chunkText(
  text: string,
  docId: string,
  chunkSize = ragConfig.chunkTokens * CHARS_PER_TOKEN,
  overlap = ragConfig.overlapTokens * CHARS_PER_TOKEN,
  strategy: ChunkStrategy = ragConfig.chunkStrategy,
): RagChunk[] {
  if (strategy === 'sentence') {
    return chunkBySentence(text, docId, chunkSize);
  }
  if (strategy === 'semantic') {
    return chunkByParagraph(text, docId, chunkSize);
  }
  // Default: fixed-size chunking
  const chunks: RagChunk[] = [];
  let i = 0;
  let idx = 0;
  while (i < text.length) {
    const end = Math.min(i + chunkSize, text.length);
    const slice = text.slice(i, end);
    const tokens = tokenize(slice);
    chunks.push({ id: `${docId}-${idx}`, docId, text: slice, index: idx, tokens });
    idx++;
    i += chunkSize - overlap;
  }
  return chunks;
}

/** Chunk by sentence boundaries — group sentences until chunk size is reached. */
function chunkBySentence(text: string, docId: string, maxSize: number): RagChunk[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: RagChunk[] = [];
  let current = '';
  let idx = 0;
  for (const sentence of sentences) {
    if (current.length + sentence.length > maxSize && current.length > 0) {
      const tokens = tokenize(current);
      chunks.push({ id: `${docId}-${idx}`, docId, text: current.trim(), index: idx, tokens });
      idx++;
      current = '';
    }
    current += sentence;
  }
  if (current.trim()) {
    const tokens = tokenize(current);
    chunks.push({ id: `${docId}-${idx}`, docId, text: current.trim(), index: idx, tokens });
  }
  return chunks;
}

/** Chunk by paragraph — split on double newlines, group small paragraphs. */
function chunkByParagraph(text: string, docId: string, maxSize: number): RagChunk[] {
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());
  const chunks: RagChunk[] = [];
  let current = '';
  let idx = 0;
  for (const para of paragraphs) {
    if (current.length + para.length > maxSize && current.length > 0) {
      const tokens = tokenize(current);
      chunks.push({ id: `${docId}-${idx}`, docId, text: current.trim(), index: idx, tokens });
      idx++;
      current = '';
    }
    current += (current ? '\n\n' : '') + para;
  }
  if (current.trim()) {
    const tokens = tokenize(current);
    chunks.push({ id: `${docId}-${idx}`, docId, text: current.trim(), index: idx, tokens });
  }
  return chunks;
}

/**
 * Simple whitespace tokenizer with lowercasing and stopword removal.
 */
function tokenize(text: string): string[] {
  const STOP = new Set([
    "the",
    "a",
    "an",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "shall",
    "can",
    "to",
    "of",
    "in",
    "for",
    "on",
    "with",
    "at",
    "by",
    "from",
    "as",
    "into",
    "through",
    "during",
    "before",
    "after",
    "above",
    "below",
    "between",
    "out",
    "off",
    "over",
    "under",
    "again",
    "further",
    "then",
    "once",
    "and",
    "but",
    "or",
    "nor",
    "not",
    "so",
    "if",
    "that",
    "this",
    "it",
    "its",
    "i",
    "we",
    "you",
    "he",
    "she",
    "they",
    "me",
    "him",
    "her",
    "us",
    "them",
    "my",
    "your",
    "his",
  ]);
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/**
 * FR-034: Index a document's text — chunk and store.
 */
export function indexDocument(docId: string, text: string): number {
  const chunks = chunkText(text, docId);
  chunkStore.set(docId, chunks);
  persistChunks();
  return chunks.length;
}

/**
 * EC-016: Index a document in a Web Worker for large files.
 */
export function indexDocumentFromWorker(docId: string, text: string): Promise<number> {
  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(
        new URL("./rag-worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.onmessage = (e) => {
        const { chunkCount, chunks } = e.data;
        // Store the chunks from worker in our chunk store
        chunkStore.set(docId, chunks);
        persistChunks();
        worker.terminate();
        resolve(chunkCount);
      };
      worker.onerror = (err) => {
        worker.terminate();
        reject(new Error(err.message));
      };
      worker.postMessage({
        type: "index",
        docId,
        text,
        chunkSize: ragConfig.chunkTokens * CHARS_PER_TOKEN,
        overlap: ragConfig.overlapTokens * CHARS_PER_TOKEN,
      });
    } catch {
      // Fallback to sync if workers not supported
      resolve(indexDocument(docId, text));
    }
  });
}

/**
 * Remove a document's chunks from the index.
 */
export function removeDocumentIndex(docId: string): void {
  chunkStore.delete(docId);
  persistChunks();
}

/**
 * FR-035: Retrieve top-K relevant chunks for a query using BM25-like scoring.
 */
export function retrieveChunks(
  query: string,
  docIds: string[],
  topK = 5,
): RagChunk[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const candidates: Array<{ chunk: RagChunk; score: number }> = [];

  for (const docId of docIds) {
    const chunks = chunkStore.get(docId);
    if (!chunks) continue;
    for (const chunk of chunks) {
      let score = 0;
      for (const qt of queryTokens) {
        const tf = chunk.tokens.filter((t) => t === qt).length;
        if (tf > 0) {
          // BM25-like: TF saturation
          score += (tf * 2.0) / (tf + 1.0);
        }
      }
      if (score > 0) {
        candidates.push({ chunk, score });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, topK).map((c) => c.chunk);
}

/**
 * FR-035: Build a context string from retrieved chunks with source citations.
 * FR-036: Include source document references.
 */
export function buildRagContext(
  chunks: RagChunk[],
  docNames: Map<string, string>,
): string {
  if (chunks.length === 0) return "";
  const parts = chunks.map((c) => {
    const name = docNames.get(c.docId) ?? c.docId;
    return `[Source: ${name}, chunk ${c.index + 1}]\n${c.text}`;
  });
  return (
    "--- Relevant context from attached documents ---\n" +
    parts.join("\n\n") +
    "\n--- End of context ---\n"
  );
}

/**
 * FR-034: Read a File object and return its text content.
 * Supports .txt, .md, .csv, .json, .html, .pdf, .docx files.
 */
export async function readFileAsText(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  // FR-034: PDF parsing via pdfjs-dist
  if (ext === "pdf") {
    const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
    // Use bundled worker
    GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    const buf = await file.arrayBuffer();
    const pdf = await getDocument({ data: buf }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((item: unknown) => (item as { str?: string }).str ?? "").join(" "));
    }
    return pages.join("\n\n");
  }

  // FR-034: DOCX parsing via mammoth
  if (ext === "docx") {
    const mammoth = await import("mammoth");
    const buf = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    return result.value;
  }

  // Default: read as text (.txt, .md, .csv, .json, .html)
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsText(file);
  });
}
