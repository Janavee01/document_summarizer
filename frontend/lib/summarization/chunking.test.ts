import { describe, expect, it } from "vitest";

import { chunkText } from "./chunking";

const MAX_CHUNK_CHARACTERS = 30_000;

function makeParagraphs(count: number, wordsPerParagraph = 50): string {
  return Array.from(
    { length: count },
    (_, i) =>
      `Paragraph ${i}: ` +
      Array.from({ length: wordsPerParagraph }, (_, w) => `word${w}`).join(" "),
  ).join("\n\n");
}

describe("chunkText", () => {
  it("returns an empty array for empty or whitespace-only input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\t  ")).toEqual([]);
  });

  it("returns a single chunk for short input", () => {
    const chunks = chunkText("A short document.");

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      index: 0,
      text: "A short document.",
      startCharacter: 0,
      endCharacter: 17,
    });
  });

  it("trims surrounding whitespace before chunking", () => {
    const chunks = chunkText("   hello world   ");

    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe("hello world");
  });

  it("produces chunks no larger than the character limit", () => {
    const text = Array.from(
      { length: MAX_CHUNK_CHARACTERS * 2 },
      (_, i) => (i % 60 === 59 ? ". " : "a"),
    ).join("");

    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);

    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(MAX_CHUNK_CHARACTERS);
    }
  });

  it("prefers paragraph breaks over hard cuts when splitting long texts", () => {
    // ~35k chars of \n\n-separated paragraphs — enough to force 2 chunks.
    const paragraphs = makeParagraphs(120, 40);
    const chunks = chunkText(paragraphs);

    expect(chunks.length).toBeGreaterThan(1);

    for (const chunk of chunks) {
      expect(chunk.text.endsWith("\n")).toBe(false);
      expect(chunk.text.startsWith("\n")).toBe(false);
    }

    // Every chunk boundary should fall on a paragraph break in the original
    // trimmed text: the character after a chunk end is either EOF or "\n".
    for (const chunk of chunks) {
      if (chunk.endCharacter < paragraphs.trim().length) {
        expect(paragraphs[chunk.endCharacter]).toMatch(/\s/);
      }
    }
  });

  it("falls back to sentence boundaries when no paragraph break fits", () => {
    // One giant ~44k-char paragraph of sentences; each ends with ". ".
    const sentences = Array.from(
      { length: 600 },
      (_, i) =>
        `This is sentence number ${i} and it contains several filler words to grow.`,
    ).join(". ");
    const text = `${sentences}.`;

    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);

    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(MAX_CHUNK_CHARACTERS);
      // Chunks cut at sentence boundaries should not end mid-word.
      expect(/[a-z0-9.]$/i.test(chunk.text)).toBe(true);
    }
  });

  it("assigns sequential zero-based indices and non-overlapping ranges", () => {
    const text = makeParagraphs(80, 60);
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);

    chunks.forEach((chunk, i) => {
      expect(chunk.index).toBe(i);
    });

    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].startCharacter).toBeGreaterThanOrEqual(
        chunks[i - 1].endCharacter,
      );
    }
  });

  it("reconstructs the full content across chunks", () => {
    const text = makeParagraphs(60, 50);
    const chunks = chunkText(text);

    const rejoined = chunks.map((c) => c.text).join("\n\n");
    const originalWords = text.split(/\s+/);
    const rejoinedWords = rejoined.split(/\s+/);

    // Whitespace between boundaries may differ, so compare word streams.
    expect(rejoinedWords).toEqual(originalWords);
  });
});
