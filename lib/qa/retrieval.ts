/*
 * Lightweight RAG retrieval: splits the document into overlapping
 * chunks, represents each chunk as a TF-IDF weighted term vector and
 * ranks chunks against the query with cosine similarity. No external
 * embedding service needed — good enough for grounding QA answers.
 */

const CHUNK_CHARACTERS = 1_200;
const CHUNK_OVERLAP = 200;
const MAX_CHUNKS = 400;

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "can", "did",
  "do", "does", "for", "from", "had", "has", "have", "how", "i", "if",
  "in", "into", "is", "it", "its", "may", "of", "on", "or", "our",
  "s", "shall", "should", "so", "such", "t", "than", "that", "the",
  "their", "them", "then", "there", "these", "they", "this", "to",
  "was", "we", "were", "what", "when", "where", "which", "who", "whom",
  "why", "will", "with", "would", "you", "your",
]);

export interface RetrievedChunk {
  index: number;
  text: string;
}

interface IndexedChunk {
  index: number;
  text: string;
  vector: Map<string, number>;
  norm: number;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function buildTermFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();

  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1);
  }

  // Sub-linear scaling dampens repeated terms.
  for (const [term, count] of tf) {
    tf.set(term, 1 + Math.log(count));
  }

  return tf;
}

function splitIntoChunks(text: string): string[] {
  const trimmed = text.trim();

  if (!trimmed) {
    return [];
  }

  if (trimmed.length <= CHUNK_CHARACTERS) {
    return [trimmed];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < trimmed.length && chunks.length < MAX_CHUNKS) {
    let end = Math.min(start + CHUNK_CHARACTERS, trimmed.length);

    if (end < trimmed.length) {
      const searchStart = Math.max(
        start + Math.floor(CHUNK_CHARACTERS / 2),
        end - 600
      );

      const paragraphBreak = trimmed.lastIndexOf("\n\n", end);
      const sentenceBreak = Math.max(
        trimmed.lastIndexOf(". ", end),
        trimmed.lastIndexOf("? ", end),
        trimmed.lastIndexOf("! ", end)
      );

      if (paragraphBreak >= searchStart) {
        end = paragraphBreak;
      } else if (sentenceBreak >= searchStart) {
        end = sentenceBreak + 1;
      }
    }

    const chunk = trimmed.slice(start, end).trim();

    if (chunk.length > 40 || chunks.length === 0) {
      chunks.push(chunk);
    }

    start = Math.max(end - CHUNK_OVERLAP, start + 1);

    if (end >= trimmed.length) {
      break;
    }
  }

  return chunks;
}

export class DocumentIndex {
  private readonly chunks: IndexedChunk[];
  private readonly idf: Map<string, number>;

  constructor(documentText: string) {
    const rawChunks = splitIntoChunks(documentText);
    const termFrequencies = rawChunks.map((chunk) =>
      buildTermFrequency(tokenize(chunk))
    );

    // Inverse document frequency across chunks.
    this.idf = new Map();
    const documentCount = rawChunks.length;

    for (const tf of termFrequencies) {
      for (const term of tf.keys()) {
        this.idf.set(term, (this.idf.get(term) ?? 0) + 1);
      }
    }

    for (const [term, containingChunks] of this.idf) {
      this.idf.set(
        term,
        Math.log((documentCount + 1) / (containingChunks + 0.5))
      );
    }

    this.chunks = rawChunks.map((text, index) => {
      const vector = new Map<string, number>();
      let squaredNorm = 0;

      for (const [term, tf] of termFrequencies[index]) {
        const weight = tf * (this.idf.get(term) ?? 0);

        if (weight > 0) {
          vector.set(term, weight);
          squaredNorm += weight * weight;
        }
      }

      return {
        index,
        text,
        vector,
        norm: Math.sqrt(squaredNorm),
      };
    });
  }

  get chunkCount(): number {
    return this.chunks.length;
  }

  search(query: string, topK = 4): RetrievedChunk[] {
    if (this.chunks.length === 0) {
      return [];
    }

    const queryVector = new Map<string, number>();
    let querySquaredNorm = 0;

    for (const [term, tf] of buildTermFrequency(tokenize(query))) {
      const weight = tf * (this.idf.get(term) ?? 0);

      if (weight > 0) {
        queryVector.set(term, weight);
        querySquaredNorm += weight * weight;
      }
    }

    const queryNorm = Math.sqrt(querySquaredNorm);

    const scored = this.chunks.map((chunk) => {
      let dotProduct = 0;

      for (const [term, weight] of queryVector) {
        const chunkWeight = chunk.vector.get(term);

        if (chunkWeight !== undefined) {
          dotProduct += weight * chunkWeight;
        }
      }

      const similarity =
        queryNorm > 0 && chunk.norm > 0
          ? dotProduct / (queryNorm * chunk.norm)
          : 0;

      return { chunk, similarity };
    });

    scored.sort((a, b) => b.similarity - a.similarity);

    return scored.slice(0, topK).map(({ chunk }) => ({
      index: chunk.index,
      text: chunk.text,
    }));
  }
}
