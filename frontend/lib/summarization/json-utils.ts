/*
 * Reasoning models sometimes emit hidden-chain-of-thought blocks (or stray
 * prose) around the JSON payload, and free-tier models can truncate output.
 * Parsing is therefore deliberately defensive: strip think blocks, try the
 * whole response, then scan every {...} candidate for the first one that
 * parses as a complete object.
 */
export function extractJson(raw: string): unknown {
  // Closed think blocks are removed outright. An *unclosed* block is left
  // in place: the candidate scan below tolerates braces in surrounding
  // prose, whereas stripping to end-of-string would discard real payloads
  // that follow truncated reasoning.
  const cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  // First: try the complete response directly.
  try {
    return JSON.parse(cleaned);
  } catch {
    // Continue with fallback extraction.
  }

  const start = cleaned.indexOf("{");

  if (start === -1) {
    throw new Error("The model returned a response that couldn't be parsed.");
  }

  // Second: walk forward through every '{' and return the first position
  // where a balanced, parseable object completes. A single unparseable
  // candidate (e.g. braces inside reasoning text) doesn't abort the scan.
  let cursor = start;

  while (cursor < cleaned.length) {
    const objectStart = cleaned.indexOf("{", cursor);

    if (objectStart === -1) {
      break;
    }

    const objectEnd = findBalancedObjectEnd(cleaned, objectStart);

    if (objectEnd === -1) {
      // Unbalanced from here — nothing later can be balanced either if this
      // was truncated at the very end; still advance to keep scanning safe.
      cursor = objectStart + 1;
      continue;
    }

    try {
      return JSON.parse(cleaned.slice(objectStart, objectEnd + 1));
    } catch {
      cursor = objectStart + 1;
    }
  }

  throw new Error("The model returned a response that couldn't be parsed.");
}

/** Returns the index of the '}' closing the object opened at `openIndex`. */
function findBalancedObjectEnd(
  input: string,
  openIndex: number
): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = openIndex; i < input.length; i++) {
    const char = input[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;

      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
}

export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is string =>
      typeof item === "string" && item.trim().length > 0
  );
}
