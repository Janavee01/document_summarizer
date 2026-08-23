/**
 * Normalizes extracted PDF/OCR text while preserving
 * meaningful document structure.
 *
 * This does NOT attempt to recreate the original visual layout.
 * It focuses on making extracted text readable and suitable
 * for downstream summarization.
 */

export function normalizeExtractedText(text: string): string {
  if (!text.trim()) {
    return "";
  }

  let normalized = text;

  // Normalize different newline styles.
  normalized = normalized.replace(/\r\n/g, "\n");
  normalized = normalized.replace(/\r/g, "\n");

  // Normalize non-breaking spaces.
  normalized = normalized.replace(/\u00a0/g, " ");

  // Remove trailing whitespace from every line.
  normalized = normalized
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");

  // Fix words split across a line break:
  //
  // "manage-\nment" -> "management"
  //
  // Only join when the hyphen is directly attached to a word.
  normalized = normalized.replace(
    /([A-Za-z])-\n([a-z])/g,
    "$1$2",
  );

  // Collapse spaces/tabs inside ordinary lines.
  normalized = normalized
    .split("\n")
    .map((line) =>
      line.replace(/[ \t]+/g, " ").trim(),
    )
    .join("\n");

  // Rejoin lines that are clearly continuations of
  // the same paragraph.
  //
  // The accumulated line is re-checked against every
  // following line, so a chain of wrapped fragments
  // (e.g. three-line paragraphs) is merged completely
  // instead of only pairwise.
  const lines = normalized.split("\n");
  const rebuilt: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let current = lines[i];

    if (!current) {
      rebuilt.push("");
      continue;
    }

    while (
      i + 1 < lines.length &&
      shouldJoinLines(current, lines[i + 1])
    ) {
      current = `${current} ${lines[i + 1]}`;
      i++;
    }

    rebuilt.push(current);
  }

  normalized = rebuilt.join("\n");

  // Prevent excessive blank lines.
  normalized = normalized.replace(
    /\n{3,}/g,
    "\n\n",
  );

  return normalized.trim();
}

/**
 * Determines whether two consecutive lines are probably
 * part of the same paragraph.
 *
 * This deliberately uses conservative heuristics.
 */
function shouldJoinLines(
  current: string,
  next: string,
): boolean {
  if (!current || !next) {
    return false;
  }

  // Don't join headings or obvious list items.
  if (looksLikeHeading(current)) {
    return false;
  }

  if (looksLikeListItem(next)) {
    return false;
  }

  // A sentence ending in punctuation is usually complete.
  if (/[.!?:;]$/.test(current)) {
    return false;
  }

  // If the next line begins with a capital letter,
  // it may be a new sentence/paragraph.
  //
  // We allow common continuation words separately.
  if (/^[A-Z][a-z]/.test(next)) {
    return false;
  }

  // Lowercase starts are strong evidence that this is
  // a continuation of the previous line.
  if (/^[a-z]/.test(next)) {
    return true;
  }

  // Lines ending without punctuation are often wrapped
  // PDF lines.
  if (!/[.!?:;]$/.test(current)) {
    return true;
  }

  return false;
}

function looksLikeHeading(line: string): boolean {
  const trimmed = line.trim();

  if (!trimmed) {
    return false;
  }

  // Markdown-style headings.
  if (/^#{1,6}\s/.test(trimmed)) {
    return true;
  }

  // Numbered headings such as:
  // 1 Introduction
  // 2.1 Background
  if (/^\d+(?:\.\d+)*\.?\s+[A-Z]/.test(trimmed)) {
    return true;
  }

  // Very short all-uppercase lines.
  // Commas/periods are allowed so titles such as
  // "THE TRANSFER OF PROPERTY ACT, 1882" are still
  // recognized as headings.
  if (
    trimmed.length <= 100 &&
    /^[A-Z0-9][A-Z0-9\s\-:&,.]+$/.test(trimmed)
  ) {
    return true;
  }

  return false;
}

function looksLikeListItem(line: string): boolean {
  const trimmed = line.trim();

  return (
    /^[-•▪◦*]\s+/.test(trimmed) ||
    /^\(?[a-zA-Z0-9]+\)\s+/.test(trimmed) ||
    /^\d+[A-Za-z]?[.)]\s+/.test(trimmed)
  );
}
