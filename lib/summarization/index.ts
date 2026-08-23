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

Target approximately 250-400 words.

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
    maxTokens: 700
  });
}

function buildFinalPrompt(
  summaries: string[],
  length: SummaryLength
): string {
  return `Create the final structured summary of the document using ONLY the section summaries provided below.

The section summaries represent different parts of the same document. Combine them carefully and remove duplication.

Summary length:
${LENGTH_GUIDANCE[length]}

Return exactly one JSON object with this structure:

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
- actionItems: concrete actions, decisions, requirements, or to-dos explicitly supported by the document. Use [] if there are none.
- Do not invent information.
- Use only information supported by the section summaries.
- Combine related information across sections.
- Remove repeated information.

Important:
- Return one JSON object only.
- Do not use markdown.
- Do not use code fences.
- Do not include explanations or reasoning.
- Do not include any text before or after the JSON object.

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

    improvementSuggestions: toStringArray(
      data.improvementSuggestions
    ),
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

  console.log(
    "========== CHUNKED SUMMARIZATION =========="
  );

  console.log(
    "Original characters:",
    trimmedInput.length
  );

  console.log(
    "Number of chunks:",
    chunks.length
  );

  console.log(
    "Total characters across chunks:",
    chunks.reduce(
      (total, chunk) => total + chunk.text.length,
      0
    )
  );

  console.log(
    "Chunk sizes:",
    chunks.map((chunk) => chunk.text.length)
  );

  console.log(
    "============================================"
  );

  try {
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

    console.log(
      "========== CHUNK SUMMARIES COMPLETE =========="
    );

    console.log(
      "Generated summaries:",
      chunkSummaries.length
    );

    console.log(
      "==============================================="
    );

    console.log("========== CHUNK SUMMARY CONTENT ==========");
chunkSummaries.forEach((summary, index) => {
  console.log(`--- Chunk ${index + 1} ---`);
  console.log(summary);
});
console.log("============================================");
    /*
     * Step 2:
     * Give all intermediate summaries to the model
     * and ask it to produce the final structured result.
     */
    const finalPrompt = buildFinalPrompt(
      chunkSummaries,
      length
    );

    console.log("========== FINAL AGGREGATION ==========");
    console.log("Final prompt characters:", finalPrompt.length);
    console.log(
      "Final prompt estimated tokens:",
      Math.ceil(finalPrompt.length / 4)
    );
    console.log("Requested output tokens:", 5000);
    console.log("JSON mode:", true);
    console.log("========================================");

   const rawText = await callOpenRouter(
  finalPrompt,
  {
    maxTokens: 5000,
    jsonMode: true,
  }
);

    console.log(
      "========== FINAL MODEL RESPONSE =========="
    );

    console.log(rawText);

    console.log(
      "=========================================="
    );

    /*
     * Step 3:
     * Parse and validate the final JSON.
     */
    const parsed = extractJson(rawText);

    return normalizeSummary(parsed);
  } catch (error) {
  console.error("========== SUMMARIZATION ERROR ==========");
  console.error(error);
  console.error("==========================================");

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