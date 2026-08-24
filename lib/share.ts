import type { Summary } from "@/types/summary";
import { isSummary } from "@/lib/summary-validation";

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

    if (!isSummary(parsed)) return null;

    return {
      title: parsed.title,
      documentType: parsed.documentType,
      summary: parsed.summary,
      keyPoints: parsed.keyPoints,
      mainIdeas: parsed.mainIdeas,
      entities: parsed.entities,
      actionItems: parsed.actionItems,
      improvementSuggestions: parsed.improvementSuggestions,
    };
  } catch {
    return null;
  }
}
