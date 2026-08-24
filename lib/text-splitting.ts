/*
 * Shared text-boundary helpers used by document chunkers
 * (summarization chunking and QA retrieval) so large texts are
 * split at natural boundaries consistently across features.
 */

/**
 * Returns the adjusted end position for a chunk that would end at
 * `end`: the largest paragraph break ("\\n\\n") at or after
 * `minPosition`, falling back to the largest sentence break
 * (". ", "? ", "! ") at or after `minPosition`, or `end` unchanged
 * when neither exists within the search window.
 *
 * A sentence break includes its trailing punctuation, so chunks never
 * start mid-sentence.
 */
export function findNaturalBreak(
  text: string,
  end: number,
  minPosition: number
): number {
  const paragraphBreak = text.lastIndexOf("\n\n", end);

  const sentenceBreak = Math.max(
    text.lastIndexOf(". ", end),
    text.lastIndexOf("? ", end),
    text.lastIndexOf("! ", end)
  );

  if (paragraphBreak >= minPosition) {
    return paragraphBreak;
  }

  if (sentenceBreak >= minPosition) {
    return sentenceBreak + 1;
  }

  return end;
}
