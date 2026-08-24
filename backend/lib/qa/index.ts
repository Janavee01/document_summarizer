import { callOpenRouter } from "@/lib/summarization/openrouter";
import { extractJson, toStringArray } from "@/lib/summarization/json-utils";
import { DocumentIndex } from "./retrieval";

export class QaConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QaConfigError";
  }
}

export class QaRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QaRequestError";
  }
}

const MIN_DOCUMENT_LENGTH = 80;

function assertDocumentText(documentText: string): void {
  if (!documentText.trim()) {
    throw new QaRequestError("There is no document text to work with.");
  }

  if (documentText.trim().length < MIN_DOCUMENT_LENGTH) {
    throw new QaRequestError(
      "The extracted text is too short to ask questions about."
    );
  }
}

/*
 * Suggested questions are generated from a representative sample of the
 * document: the beginning (context), the middle and the end. This keeps
 * the prompt small even for large documents while still covering it.
 *
 * The free reasoning model spends a large, variable share of its token
 * budget on hidden reasoning before emitting the JSON, so maxTokens must
 * be generous and failures get one retry — otherwise long documents hit
 * truncation and the call fails intermittently.
 */
const QUESTION_ATTEMPTS = 2;
const QUESTION_MAX_TOKENS = 2_000;

export async function generateSuggestedQuestions(
  documentText: string,
  count = 7
): Promise<string[]> {
  assertDocumentText(documentText);

  let lastError: unknown;

  for (let attempt = 1; attempt <= QUESTION_ATTEMPTS; attempt++) {
    try {
      return await requestSuggestedQuestions(documentText, count);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof QaConfigError) {
    throw lastError;
  }

  throw new QaRequestError(
    "Could not generate suggested questions for this document."
  );
}

async function requestSuggestedQuestions(
  documentText: string,
  count: number
): Promise<string[]> {
  const trimmed = documentText.trim();
  const sampleSize = 6_000;

  let sample = trimmed;

  if (trimmed.length > sampleSize) {
    const head = trimmed.slice(0, sampleSize * 0.5);
    const middleStart =
      Math.floor(trimmed.length / 2) - Math.floor(sampleSize * 0.25);
    const middle = trimmed.slice(middleStart, middleStart + sampleSize * 0.25);
    const tail = trimmed.slice(-sampleSize * 0.25);

    sample = `${head}\n\n[…]\n\n${middle}\n\n[…]\n\n${tail}`;
  }

  const prompt = `Below is text from a document.

Generate exactly ${count} insightful, specific questions that a reader of this document would most likely want answered. The questions must be answerable using ONLY information present in the document.

Rules:
- Cover different aspects of the document.
- Be specific — reference concrete topics, names, figures or sections from the text.
- Do not ask about information that is not in the document.
- Each question must be a single sentence ending with a question mark.
- Return one JSON object only: {"questions": ["...", "..."]}
- Do not include any text outside the JSON object.

Document text:
"""
${sample}
"""`;

  const raw = await callOpenRouter(prompt, {
    maxTokens: QUESTION_MAX_TOKENS,
    jsonMode: true,
  });

  let parsed: unknown;
  try {
    parsed = extractJson(raw);
  } catch {
    throw new QaRequestError(
      "Could not generate suggested questions for this document."
    );
  }

  const questions = toStringArray(
    typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>).questions
      : []
  ).map((question) =>
    question.trim().endsWith("?") ? question.trim() : `${question.trim()}?`
  );

  if (questions.length === 0) {
    throw new QaRequestError(
      "Could not generate suggested questions for this document."
    );
  }

  return questions.slice(0, count);
}

export interface DocumentAnswer {
  answer: string;
  sourcesUsed: number;
}

/*
 * RAG answering: vector-search the indexed document for the chunks most
 * relevant to the question, then ground the LLM answer on those chunks.
 */
export async function answerQuestion(
  documentText: string,
  question: string
): Promise<DocumentAnswer> {
  assertDocumentText(documentText);

  const normalizedQuestion = question.trim();

  if (!normalizedQuestion) {
    throw new QaRequestError("Please provide a question.");
  }

  const index = new DocumentIndex(documentText);
  const relevantChunks = index.search(normalizedQuestion, 4);

  // Vector search should always find something for non-empty documents;
  // fall back to the opening chunk as a last resort.
  const contextChunks =
    relevantChunks.length > 0
      ? relevantChunks
      : [{ index: 0, text: documentText.slice(0, 4_000) }];

  const context = contextChunks
    .map(
      (chunk) => `--- Relevant excerpt ${chunk.index + 1} ---
${chunk.text}`
    )
    .join("\n\n");

  const prompt = `You answer questions about a document. Use ONLY the excerpts below from the document to answer.

Question: ${normalizedQuestion}

Excerpts:

${context}

Rules:
- Answer based only on the excerpts. Do not invent information.
- If the excerpts do not contain enough information to answer, say so plainly.
- Be concise: 2-6 sentences unless the question needs more detail.
- Preserve important terminology and specific figures from the document.`;

  const answer = await callOpenRouter(prompt, {
    // Reasoning tokens count against this budget on the free model.
    maxTokens: 1_200,
  });

  return {
    answer: answer.trim(),
    sourcesUsed: contextChunks.length,
  };
}
