import type { Summary } from "@/types/summary";

// Share links are self-contained: the whole summary is encoded into the URL
// fragment (`#d=…`), so nothing is stored server-side and the fragment never
// leaves the browser. Links keep working across restarts and deployments.

const SHARE_PAYLOAD_KEY = "d";

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(encoded: string): Uint8Array {
  const base64 = encoded
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padded =
    base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function buildShareLink(summary: Summary, origin: string): string {
  const payload = toBase64Url(
    new TextEncoder().encode(JSON.stringify(summary))
  );
  return `${origin}/s#${SHARE_PAYLOAD_KEY}=${payload}`;
}

export function parseShareLink(hash: string): Summary | null {
  if (!hash.startsWith("#")) return null;

  const payload = new URLSearchParams(hash.slice(1)).get(SHARE_PAYLOAD_KEY);
  if (!payload) return null;

  try {
    const parsed: unknown = JSON.parse(
      new TextDecoder().decode(fromBase64Url(payload))
    );

    if (typeof parsed !== "object" || parsed === null) return null;

    const candidate = parsed as Record<string, unknown>;

    if (
      typeof candidate.title !== "string" ||
      typeof candidate.documentType !== "string" ||
      typeof candidate.summary !== "string" ||
      !isStringArray(candidate.keyPoints) ||
      !isStringArray(candidate.mainIdeas) ||
      !isStringArray(candidate.entities) ||
      !isStringArray(candidate.actionItems) ||
      !isStringArray(candidate.improvementSuggestions)
    ) {
      return null;
    }

    return {
      title: candidate.title,
      documentType: candidate.documentType,
      summary: candidate.summary,
      keyPoints: candidate.keyPoints,
      mainIdeas: candidate.mainIdeas,
      entities: candidate.entities,
      actionItems: candidate.actionItems,
      improvementSuggestions: candidate.improvementSuggestions,
    };
  } catch {
    return null;
  }
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy path (e.g. permission denied).
    }
  }

  // Fallback for non-secure contexts where the async clipboard API is missing.
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}
