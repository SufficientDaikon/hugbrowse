/**
 * EC-016: Web Worker for RAG document indexing.
 * Prevents large document chunking from blocking the UI thread.
 */

interface ChunkMsg {
  type: "index";
  docId: string;
  text: string;
  chunkSize: number;
  overlap: number;
}

interface ChunkResult {
  type: "indexed";
  docId: string;
  chunkCount: number;
  chunks: Array<{
    id: string;
    docId: string;
    text: string;
    index: number;
    tokens: string[];
  }>;
}

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

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

self.onmessage = (e: MessageEvent<ChunkMsg>) => {
  const { docId, text, chunkSize, overlap } = e.data;
  const chunks: ChunkResult["chunks"] = [];
  let i = 0;
  let idx = 0;

  while (i < text.length) {
    const end = Math.min(i + chunkSize, text.length);
    const slice = text.slice(i, end);
    const tokens = tokenize(slice);
    chunks.push({
      id: `${docId}-${idx}`,
      docId,
      text: slice,
      index: idx,
      tokens,
    });
    idx++;
    i += chunkSize - overlap;
  }

  const result: ChunkResult = {
    type: "indexed",
    docId,
    chunkCount: chunks.length,
    chunks,
  };
  self.postMessage(result);
};

export {};
