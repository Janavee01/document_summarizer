import { findNaturalBreak } from "@/lib/text-splitting";

const MAX_CHUNK_CHARACTERS = 30_000;

export interface TextChunk {
  index: number;
  text: string;
  startCharacter: number;
  endCharacter: number;
}

export function chunkText(text: string): TextChunk[] {
  const trimmed = text.trim();

  if (!trimmed) {
    return [];
  }

  const chunks: TextChunk[] = [];

  let start = 0;
  let index = 0;

  while (start < trimmed.length) {
    let end = Math.min(
      start + MAX_CHUNK_CHARACTERS,
      trimmed.length
    );

    if (end < trimmed.length) {
      const searchStart = Math.max(start, end - 2_000);

      end = findNaturalBreak(trimmed, end, searchStart);
    }

    const chunk = trimmed.slice(start, end).trim();

    if (chunk) {
      chunks.push({
        index,
        text: chunk,
        startCharacter: start,
        endCharacter: end,
      });

      index++;
    }

    start = end;
  }

  return chunks;
}
