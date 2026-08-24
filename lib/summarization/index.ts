import type { Summary, SummaryLength } from "@/types/summary";

import { callOpenRouter } from "./openrouter";
import { chunkText } from "./chunking";
import { extractJson, toStringArray } from "./json-utils";

const LENGTH_GUIDANCE: Record<SummaryLength, string> = {
  short:
    "2-3 sentences (roughly 40-70 words). Capture only the core takeaway.",

  medium:
    "1-2 short paragraphs (roughly 120-200 words). Cover the main narrative and the most important supporting details.",

  long:
    "3-5 paragraphs (roughly 300-450 words). Be thorough — cover the main narrative, supporting details, and context a reader would need without re-reading the source.",
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

function buildChunkPrompt(
  text: string,
  chunkNumber: number,
  totalChunks: number
): string {
  return `You are analyzing part ${chunkNumber} of ${totalChunks} of a larger document.

Summarize this section accurately.

Extract:

- important facts and findings
- important arguments or ideas
- notable people, organizations, products, dates, or figures
- concrete actions, decisions, or requirements

Do not invent information.

Preserve important technical terminology.

Focus only on information present in this section.

Return a highly concise section summary for a later aggregation step.

Keep only information that is essential for understanding the document.
Avoid repeating explanations.
Do not write a full prose summary.

Target approximately 150-250 words.

Section ${chunkNumber}:

"""
${text}
"""`;
}

async function summarizeChunk(
  text: string,
  chunkNumber: number,
  totalChunks: number
): Promise<string> {
  const prompt = buildChunkPrompt(
    text,
    chunkNumber,
    totalChunks
  );

  return callOpenRouter(prompt, {
    maxTokens: 500
  });
}

/*
 * Shared output contract: field list, requirements, and formatting rules
 * used by both the single-pass and map-reduce prompts.
 */
function buildJsonContract(sourceDescription: string): string {
  return `Return exactly one JSON object with this structure:

{
  "title": "string",
  "documentType": "string",
  "summary": "string",
  "keyPoints": ["string"],
  "mainIdeas": ["string"],
  "entities": ["string"],
  "actionItems": ["string"]
}

Field requirements:

- title: concise descriptive title.
- documentType: short classification of the document.
- summary: follow the requested length.
- keyPoints: 3-6 essential facts or takeaways.
- mainIdeas: 2-5 high-level themes or arguments.
- entities: up to 8 notable people, organizations, products, dates, or figures.
- actionItems: concrete actions, decisions, requirements, or to-dos explicitly supported by the source material. Use [] if there are none.
- Do not invent information.
- Use only information present in ${sourceDescription}.
- Combine related information across sections where applicable.
- Remove repeated information.

Important:
- Return one JSON object only.
- Do not use markdown.
- Do not use code fences.
- Do not include explanations or reasoning.
- Do not include any text before or after the JSON object.`;
}

/*
 * Single-pass prompt used when the whole document fits in one chunk.
 * It produces the final structured result directly, skipping the
 * intermediate section-summary round trip entirely and roughly halving
 * end-to-end latency for typical documents.
 */
function buildDirectPrompt(
  text: string,
  length: SummaryLength
): string {
  return `Summarize the following document accurately.

Summary length:
${LENGTH_GUIDANCE[length]}

${buildJsonContract("the document below")}

Document:

"""
${text}
"""`;
}

function buildFinalPrompt(
  summaries: string[],
  length: SummaryLength
): string {
  return `Create the final structured summary of the document using ONLY the section summaries provided below.

The section summaries represent different parts of the same document. Combine them carefully and remove duplication.

Summary length:
${LENGTH_GUIDANCE[length]}

${buildJsonContract("the section summaries")}

Section summaries:

${summaries
    .map(
      (summary, index) =>
        `--- Section ${index + 1} ---
${summary}`
    )
    .join("\n\n")}
`;
}

/*
 * Free-tier models intermittently emit malformed JSON even in JSON mode.
 * A single retry resolves almost all of these without meaningfully
 * extending worst-case latency (mirrors the QA suggested-questions flow).
 */
const STRUCTURED_RESULT_ATTEMPTS = 2;

async function requestStructuredSummary(
  prompt: string,
  maxTokens: number
): Promise<Summary> {
  let lastError: unknown;

  for (let attempt = 0; attempt < STRUCTURED_RESULT_ATTEMPTS; attempt++) {
    try {
      const rawText = await callOpenRouter(prompt, {
        maxTokens,
        jsonMode: true,
      });

      return normalizeSummary(extractJson(rawText));
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

function normalizeSummary(parsed: unknown): Summary {
  if (typeof parsed !== "object" || parsed === null) {
    throw new SummarizationRequestError(
      "The summarizer returned an unexpected response shape."
    );
  }

  const data = parsed as Record<string, unknown>;

  const summary =
    typeof data.summary === "string"
      ? data.summary.trim()
      : "";

  if (!summary) {
    throw new SummarizationRequestError(
      "The summarizer did not return any summary text."
    );
  }

  return {
    title:
      typeof data.title === "string" &&
      data.title.trim()
        ? data.title.trim()
        : "Untitled document",

    documentType:
      typeof data.documentType === "string" &&
      data.documentType.trim()
        ? data.documentType.trim()
        : "Document",

    summary,

    keyPoints: toStringArray(data.keyPoints),

    mainIdeas: toStringArray(data.mainIdeas),

    entities: toStringArray(data.entities),

    actionItems: toStringArray(data.actionItems),
  };
}

export async function generateSummary(
  documentText: string,
  length: SummaryLength
): Promise<Summary> {
  const trimmedInput = documentText.trim();

  if (!trimmedInput) {
    throw new SummarizationRequestError(
      "There is no extracted text to summarize."
    );
  }

  const chunks = chunkText(trimmedInput);

  try {
    /*
     * Fast path:
     * A document that fits in one chunk is summarized in a single LLM
     * call that produces the structured result directly. The previous
     * two-step flow (section summary, then aggregation) doubled latency
     * for every typical-sized upload.
     */
    const singleChunk = chunks.length === 1 ? chunks[0] : null;

    if (singleChunk) {
      return requestStructuredSummary(
        buildDirectPrompt(singleChunk.text, length),
        2000
      );
    }

    /*
     * Step 1:
     * Summarize every chunk in parallel.
     */
    const chunkSummaries = await Promise.all(
      chunks.map((chunk) =>
        summarizeChunk(
          chunk.text,
          chunk.index + 1,
          chunks.length
        )
      )
    );

    /*
     * Step 2:
     * Give all intermediate summaries to the model
     * and ask it to produce the final structured result.
     */
    const finalPrompt = buildFinalPrompt(
      chunkSummaries,
      length
    );

    return requestStructuredSummary(finalPrompt, 5000);
  } catch (error) {
    if (error instanceof SummarizationRequestError) {
      throw error;
    }

    throw new SummarizationRequestError(
      error instanceof Error
        ? error.message
        : "Failed to summarize the document."
    );
  }
}