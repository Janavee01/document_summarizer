import { describe, expect, it } from "vitest";

import { analyzeTextQuality } from "./text-quality";

describe("analyzeTextQuality — empty input", () => {
  it("marks empty text as empty and suspicious with a zero score", () => {
    const result = analyzeTextQuality("");

    expect(result.isEmpty).toBe(true);
    expect(result.isSuspicious).toBe(true);
    expect(result.qualityScore).toBe(0);
    expect(result.characterCount).toBe(0);
    expect(result.wordCount).toBe(0);
    expect(result.reasons).toContain("No text was extracted");
  });

  it("normalizes whitespace-only input to empty", () => {
    const result = analyzeTextQuality("  \n\t  \n  ");

    expect(result.characterCount).toBe(0);
    expect(result.isEmpty).toBe(true);
  });

  it("treats sub-3-character text as empty", () => {
    const result = analyzeTextQuality("hi");

    expect(result.isEmpty).toBe(true);
    expect(result.isSuspicious).toBe(true);
  });
});

describe("analyzeTextQuality — normal text", () => {
  it("scores normal English as trustworthy", () => {
    const result = analyzeTextQuality(
      "The server understood the request but refused to authorize access " +
        "to the requested resource. The client may repeat the request " +
        "without modification at a later time.",
    );

    expect(result.isSuspicious).toBe(false);
    expect(result.qualityScore).toBeGreaterThanOrEqual(0.55);
    expect(result.reasons).toEqual([]);
  });

  it("counts characters and words on normalized text", () => {
    const result = analyzeTextQuality("Hello   world\n\nagain");

    // Whitespace is collapsed: "Hello world again" (17 chars)
    expect(result.characterCount).toBe(17);
    expect(result.wordCount).toBe(3);
    expect(result.text).toBe("Hello world again");
    expect(result.averageWordLength).toBeCloseTo(15 / 3, 5);
  });

  it("keeps technical/SQL text non-suspicious despite symbols", () => {
    const result = analyzeTextQuality(`
      SELECT DISTINCT column FROM mytable
      JOIN another_table ON mytable.column = another_table.column
      WHERE constraint_expression GROUP BY column ORDER BY column ASC;
      function update(values) { return values.map((v) => v.id); }
    `);

    expect(result.technicalStructureRatio).toBeGreaterThan(0.15);
    expect(result.isSuspicious).toBe(false);
  });
});

describe("analyzeTextQuality — corrupted input", () => {
  it("flags OCR-corrupted gibberish as suspicious", () => {
    const corrupted =
      "strnth wrdlk brrzzz xqztvwm plkdffs ghmqrst nzcvbwt " +
      "frthplkz sqwtrbnm vlkjmhrts of oder";

    const result = analyzeTextQuality(corrupted);

    expect(result.isSuspicious).toBe(true);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("flags text dominated by single-character tokens", () => {
    const result = analyzeTextQuality("a b c d e f g h i j k l m n o p q r s t u v x y z ab cd ef gh");

    expect(result.singleCharacterTokenRatio).toBeGreaterThan(0.35);
    expect(result.reasons).toContain(
      "Extracted text contains many single-character tokens",
    );
  });

  it("flags replacement characters as suspicious", () => {
    const result = analyzeTextQuality(
      "\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD some broken bytes \uFFFD\uFFFD\uFFFD\uFFFD\uFFFD here",
    );

    expect(result.suspiciousCharacterRatio).toBeGreaterThan(0.05);
    expect(result.reasons).toContain(
      "Extracted text contains suspicious characters",
    );
    expect(result.isSuspicious).toBe(true);
  });

  it("flags excessive token repetition", () => {
    const words = Array.from({ length: 40 }, () => "spam").join(" ");
    const result = analyzeTextQuality(words);

    expect(result.repeatedTokenRatio).toBeGreaterThan(0.60);
    expect(result.reasons).toContain(
      "Extracted text contains excessive token repetition",
    );
  });

  it("flags unusually long tokens", () => {
    const longToken = "a".repeat(50);
    const result = analyzeTextQuality(`${longToken} ${longToken} word word`);

    expect(result.longTokenRatio).toBeGreaterThan(0.20);
    expect(result.reasons).toContain(
      "Extracted text contains unusually long tokens",
    );
  });

  it("reports low quality score in reasons when below threshold", () => {
    const result = analyzeTextQuality(":: :: :: :: ::");

    if (!result.isSuspicious) {
      throw new Error("expected suspicious result");
    }

    const hasLowScoreReason = result.reasons.some((reason) =>
      reason.startsWith("Text quality score is low"),
    );

    expect(hasLowScoreReason).toBe(true);
  });

  it("clamps the score into [0, 1] for pathological inputs", () => {
    for (const sample of [
      "",
      "\u0000\u0001\u0002 control chars",
      Array.from({ length: 100 }, (_, i) => `${i}`).join(" "),
      "zxcvbnmlkjhgfdsaqwertyuiop".repeat(20),
    ]) {
      const result = analyzeTextQuality(sample);

      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeLessThanOrEqual(1);
    }
  });
});
