# Chunked AI Summarization — Implementation Documentation

## 1. Overview

**Feature:** Chunked AI Summarization
**Status:** Implemented; final JSON aggregation refinement in progress
**Model:** `nvidia/nemotron-3-super-120b-a12b:free`
**Provider:** OpenRouter
**API:** OpenAI-compatible Chat Completions API

The summarization system was redesigned from a single-request, truncation-based approach to a **chunk → summarize → aggregate** pipeline.

Previously, documents were truncated to 60,000 characters. For a 177,818-character document, 117,818 characters were discarded. The new implementation processes the complete extracted document.

## 2. Architecture

### Previous Architecture

```text
177,818 chars → Truncate to 60,000 → 1 LLM call → Summary
```

### Current Architecture

```text
Complete Document
       ↓
   chunkText()
       ↓
  6 document chunks
       ↓
 6 parallel LLM calls
       ↓
6 intermediate summaries
       ↓
Final aggregation LLM
       ↓
  Structured JSON
       ↓
extractJson()
       ↓
normalizeSummary()
       ↓
  Summary Object
       ↓
      UI
```

The main architectural decision was to preserve the complete document rather than silently discard content through truncation.

## 3. Document Chunking

A reusable utility was added:

```text
lib/summarization/chunking.ts
```

It exposes:

```ts
chunkText(documentText)
```

A real 136-page document containing **177,818 characters** was used for verification. It produced six chunks:

```text
Chunk 1: 29,931
Chunk 2: 29,918
Chunk 3: 29,596
Chunk 4: 29,758
Chunk 5: 29,496
Chunk 6: 29,110
```

Approximately 177,809 characters were preserved. The small difference is caused by chunk boundary and whitespace handling.

## 4. Chunk Summarization

Each chunk is independently summarized for:

* important facts and findings
* key arguments and ideas
* people, organizations, products, dates, and figures
* actions, decisions, and requirements
* important technical terminology

The model is instructed to use only information from the supplied section and avoid inventing details.

Chunk requests run concurrently:

```ts
const chunkSummaries = await Promise.all(
  chunks.map((chunk) =>
    summarizeChunk(
      chunk.text,
      chunk.index + 1,
      chunks.length
    )
  )
);
```

Verification confirmed **6 chunks → 6 successful LLM calls → 6 intermediate summaries**.

## 5. Final Aggregation

The intermediate summaries are combined into a final aggregation prompt. The final model:

* combines information across sections
* removes duplication
* identifies document-wide themes
* identifies entities and action items
* generates the title and document type
* applies the requested summary length

Expected output:

```json
{
  "title": "string",
  "documentType": "string",
  "summary": "string",
  "keyPoints": [],
  "mainIdeas": [],
  "entities": [],
  "actionItems": []
}
```

The final output is intended to remain compatible with the existing frontend `Summary` contract.

## 6. OpenRouter Client

OpenRouter communication was centralized in:

```text
lib/summarization/openrouter.ts
```

The reusable function is:

```ts
callOpenRouter()
```

It handles API key retrieval, model configuration, authentication, request construction, response extraction, and upstream error handling.

The model is configured as:

```ts
const MODEL =
  "nvidia/nemotron-3-super-120b-a12b:free";
```

The API key is read server-side through:

```env
AI_API_KEY=
```

The actual key must never be committed to Git.

## 7. Summary Length

Existing summary lengths remain unchanged:

```text
Short:  40–70 words
Medium: 120–200 words
Long:   300–450 words
```

Length guidance is applied during final aggregation rather than to individual chunks. This allows intermediate summaries to retain useful information before the final model produces the requested output length.

## 8. JSON Parsing and Normalization

LLM responses are processed through:

```ts
extractJson(rawText)
```

The parser attempts to:

1. Parse the complete response as JSON.
2. Remove Markdown code fences.
3. Locate a JSON object if additional text surrounds it.

The result is passed to:

```ts
normalizeSummary()
```

Normalization guarantees a stable summary structure. Missing arrays become `[]`, while missing fields receive defaults such as:

```text
Title: Untitled document
Document type: Document
```

A missing summary is treated as an error.

## 9. Current Issue

The chunking pipeline is working successfully. The remaining issue occurs during **final aggregation**.

The aggregation model has occasionally returned reasoning or explanatory text before the JSON:

```text
We need to combine all sections...
Let's craft the final JSON...
{ ... }
```

This can cause JSON parsing to fail and result in:

```text
502 SUMMARIZATION_FAILED
```

Therefore, the current issue is **structured JSON generation from the final aggregation call**, not document chunking or extraction.

## 10. Planned Refinement

The OpenRouter client will support optional structured-output settings:

```ts
{
  maxTokens: 3000,
  jsonMode: true
}
```

The final aggregation call will use:

```ts
callOpenRouter(finalPrompt, {
  maxTokens: 3000,
  jsonMode: true
});
```

Chunk calls remain normal text generation:

```ts
callOpenRouter(chunkPrompt, {
  maxTokens: 1200
});
```

This separates intermediate text generation from final structured JSON generation.

## 11. Error Handling

The pipeline handles failures across:

```text
Chunking
   ↓
Chunk LLM calls
   ↓
Final LLM call
   ↓
JSON parsing
   ↓
Normalization
```

Existing error abstractions remain:

```ts
SummarizationRequestError
OpenRouterError
```

The API route converts these errors into the application's standard API error format.

## 12. Files

**Added:**

```text
lib/summarization/chunking.ts
lib/summarization/openrouter.ts
```

**Modified:**

```text
lib/summarization/index.ts
```

The existing `generateSummary()` interface remains unchanged, so the API route and frontend continue using the same summary contract.

## 13. Verification

Testing was performed using a real **136-page document**:

```text
Extracted characters: 177,818
Chunks generated:    6
Chunk summaries:     6
```

Extraction succeeded:

```text
POST /api/extract 200
```

All six chunk-level LLM requests completed successfully:

```text
========== CHUNK SUMMARIES COMPLETE ==========
Generated summaries: 6
===============================================
```

TypeScript checks and the production build also passed.

## 14. Trade-offs

For a six-chunk document:

```text
Previous: 1 LLM request

Current:
6 chunk requests
+
1 aggregation request
=
7 LLM requests
```

The new approach increases model usage, latency, and orchestration complexity. However, it provides significantly better coverage and scalability because large documents are no longer truncated.

## 15. Final Implementation Status

The system has moved from:

```text
TRUNCATE → SINGLE LLM REQUEST
```

to:

```text
CHUNK → SUMMARIZE → AGGREGATE
```

