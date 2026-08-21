import type { Summary, SummaryLength } from "@/types/summary";
import { chunkText } from "./chunking";
// Keep the request comfortably inside the model's context window and cap
// cost/latency. Very long documents are truncated with a note appended to
// the prompt so the model knows the input was cut down.
const MAX_INPUT_CHARACTERS = 60_000;

const LENGTH_GUIDANCE: Record<SummaryLength, string> = {
  short: "2-3 sentences (roughly 40-70 words). Capture only the core takeaway.",
  medium:
    "1-2 short paragraphs (roughly 120-200 words). Cover the main narrative and the most important supporting details.",
  long: "3-5 paragraphs (roughly 300-450 words). Be thorough — cover the main narrative, supporting details, and context a reader would need without re-reading the source.",
};

export class SummarizationConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SummarizationConfigError";
  }
}

export class SummarizationRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SummarizationRequestError";
  }
}

function truncateText(text: string): { text: string; truncated: boolean } {
  const trimmed = text.trim();

  if (trimmed.length <= MAX_INPUT_CHARACTERS) {
    return { text: trimmed, truncated: false };
  }

  return { text: trimmed.slice(0, MAX_INPUT_CHARACTERS), truncated: true };
}

function buildPrompt(text: string, length: SummaryLength, truncated: boolean): string {
  const truncationNote = truncated
    ? "\n\nNote: the document was too long to include in full — you are working from its opening portion only. Do not mention this limitation in the summary itself."
    : "";

  return `You are an assistant that reads documents and produces accurate, well-structured summaries.

Summarize the document below. Length requirement for the "summary" field: ${LENGTH_GUIDANCE[length]}

Also extract:
- keyPoints: the essential facts, findings, or takeaways a reader must not miss (3-6 short bullet-style strings).
- mainIdeas: the high-level themes or arguments the document is organized around (2-5 short strings).
- entities: notable people, organizations, products, dates, or figures mentioned (up to 8 strings; omit if none are relevant).
- actionItems: concrete next steps, decisions, or to-dos implied by the document (omit / empty array if none exist).
- documentType: a short label for what kind of document this is (e.g. "Meeting notes", "Research paper", "Invoice", "Contract").
- title: a concise descriptive title for the document (a few words), inferred from its content.

Respond with ONLY a single JSON object, no markdown fences, no preamble, matching exactly this shape:
{
  "title": string,
  "documentType": string,
  "summary": string,
  "keyPoints": string[],
  "mainIdeas": string[],
  "entities": string[],
  "actionItems": string[]
}

Document:
"""
${text}
"""${truncationNote}`;
}

function extractJson(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Fall back to grabbing the first {...} block in case the model added
    // any stray text around the JSON despite instructions.
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new SummarizationRequestError(
      "The summarizer returned a response that couldn't be parsed."
    );
  }
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function normalizeSummary(parsed: unknown): Summary {
  if (typeof parsed !== "object" || parsed === null) {
    throw new SummarizationRequestError("The summarizer returned an unexpected response shape.");
  }

  const data = parsed as Record<string, unknown>;

  const summary = typeof data.summary === "string" ? data.summary.trim() : "";
  if (!summary) {
    throw new SummarizationRequestError("The summarizer did not return any summary text.");
  }

  return {
    title: typeof data.title === "string" && data.title.trim() ? data.title.trim() : "Untitled document",
    documentType:
      typeof data.documentType === "string" && data.documentType.trim()
        ? data.documentType.trim()
        : "Document",
    summary,
    keyPoints: toStringArray(data.keyPoints),
    mainIdeas: toStringArray(data.mainIdeas),
    entities: toStringArray(data.entities),
    actionItems: toStringArray(data.actionItems),
    improvementSuggestions: toStringArray(data.improvementSuggestions),
  };
}

export async function generateSummary(
  documentText: string,
  length: SummaryLength
): Promise<Summary> {
  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) {
    throw new SummarizationConfigError(
      "AI_API_KEY is not configured on the server. Add a free OpenRouter API key to your environment to enable summarization."
    );
  }

  const trimmedInput = documentText.trim();
  if (!trimmedInput) {
    throw new SummarizationRequestError("There is no extracted text to summarize.");
  }

  const chunks = chunkText(trimmedInput);

console.log("========== CHUNKING TEST ==========");
console.log("Original characters:", trimmedInput.length);
console.log("Number of chunks:", chunks.length);
console.log(
  "Total characters across chunks:",
  chunks.reduce((total, chunk) => total + chunk.text.length, 0)
);
console.log(
  "Chunk sizes:",
  chunks.map((chunk) => chunk.text.length)
);
console.log("====================================");

  const { text, truncated } = truncateText(trimmedInput);
  console.log("========== SUMMARIZATION INPUT ==========");
  console.log("Original characters:", trimmedInput.length);
  console.log("Characters sent to model:", text.length);
  console.log("Was truncated:", truncated);
  console.log("==========================================");
  const prompt = buildPrompt(text, length, truncated);

  // OpenRouter's free tier (":free" model suffix) carries no per-token
  // cost — only an API key is required, which is free to create.
  let response: Response;
  try {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "nvidia/nemotron-3-super-120b-a12b:free",
        max_tokens: 1500,
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch {
    throw new SummarizationRequestError(
      "Could not reach the summarization service. Check your connection and try again."
    );
  }

  if (!response.ok) {
    let detail = "";
    try {
      const errBody = await response.json();
      detail = errBody?.error?.message ?? "";
    } catch {
      // ignore body parse failures
    }

    throw new SummarizationRequestError(
      detail
        ? `Summarization service error: ${detail}`
        : `Summarization service returned an error (status ${response.status}).`
    );
  }

  const payload = await response.json();
  const rawText: string = payload?.choices?.[0]?.message?.content ?? "";

  if (!rawText.trim()) {
    throw new SummarizationRequestError("The summarizer returned an empty response.");
  }

  const parsed = extractJson(rawText);
  return normalizeSummary(parsed);
}