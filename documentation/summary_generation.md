# Summary Generation 

## Overview

This feature adds AI-generated summaries of the text extracted from an uploaded document. Once extraction succeeds, the user can generate a **short**, **medium**, or **long** summary containing a title, document type, summary paragraph, key points, main ideas, action items, and notable entities.

It uses a **free, no-API-fee model** — [OpenRouter](https://openrouter.ai)'s free tier serving `meta-llama/llama-3.3-70b-instruct:free`.

## Approach

1. **API route** — `app/api/summarize/route.ts`
   Accepts `POST { text: string, length: "short" | "medium" | "long" }`. Validates the input, then delegates to the summarization core. Responses follow the same `{ success, data | error }` shape as the existing `/api/extract` route so the frontend handles both consistently.

2. **Summarization core** — `lib/summarization/index.ts`
   - Builds a single prompt where the requested length maps to explicit word-count guidance (rather than generating a long summary and truncating it — that would cut sentences mid-thought).
   - Caps input text at ~60,000 characters before sending it to the model, to keep latency and the free tier's context limits predictable.
   - Calls OpenRouter's OpenAI-compatible `POST /api/v1/chat/completions` endpoint via plain `fetch` — no SDK dependency needed.
   - Asks the model to return a single raw JSON object and parses it defensively: strips any markdown code fences, and if the model added stray text around the JSON despite instructions, falls back to extracting the first `{...}` block with a regex before parsing.
   - Normalizes the parsed result into the `Summary` type (`types/summary.ts`), coercing missing/malformed fields to safe defaults (empty arrays, fallback title/type strings) rather than trusting the model's output shape blindly.

3. **Length control** — three fixed options (`short` / `medium` / `long`), each with distinct word-count targets baked into the prompt. Switching the length in the UI after a summary already exists automatically regenerates it at the new length.

4. **UI** — `components/summary/summary-panel.tsx`
   Renders below the extracted document text once extraction succeeds. States:
   - **Idle** — a "Generate summary" call-to-action.
   - **Loading** — spinner with a length-aware status message (`aria-live="polite"` for screen readers).
   - **Success** — structured result: title, document-type tag, summary text, then key points / main ideas / action items as bulleted lists (only rendered if non-empty), and entities as pill tags. A "Regenerate" button re-runs the current length.
   - **Error** — the error message plus a "Try again" button; no raw error detail or stack trace is ever shown to the user.

## Error Handling

| Situation | Response | User-facing behavior |
|---|---|---|
| No `AI_API_KEY` configured | `500 CONFIG_ERROR` | Clear message that summarization isn't configured; key is never logged or exposed |
| Empty / whitespace-only request body or missing `text` | `400 INVALID_INPUT` | Rejected before any network call is made |
| Invalid `length` value | Silently defaults to `"medium"` | No error — this keeps the endpoint forgiving for future frontend changes |
| Network failure reaching OpenRouter | `502 SUMMARIZATION_FAILED` | "Could not reach the summarization service..." + Try again |
| Non-2xx response from OpenRouter | `502 SUMMARIZATION_FAILED` | Upstream error detail (if present) is included in the server log only; the client gets a generic message |
| Model response isn't valid/parseable JSON | `502 SUMMARIZATION_FAILED` | "The summarizer returned a response that couldn't be parsed." |
| Model returns valid JSON but with no usable `summary` field | `502 SUMMARIZATION_FAILED` | "The summarizer did not return any summary text." |
| Any unexpected exception | `500 SUMMARIZATION_FAILED` | Generic retry message; real error goes to `console.error` server-side only |

All error paths return the same `{ success: false, error: { code, message } }` shape, so the frontend has one place (`SummaryPanel`) that handles every failure mode without needing to special-case them.

## Configuration

Add to `.env.local` (see `.env.example`):

```
AI_API_KEY=your-openrouter-api-key
```

## Files

**Added**
- `app/api/summarize/route.ts`
- `lib/summarization/index.ts`
- `components/summary/summary-panel.tsx`
- `documentation/summary-generation.md` 