# Testing

## 1. Overview

The project uses **Vitest** as its unit test framework. Tests are colocated with the code they cover (`*.test.ts` next to each module) so they are easy to find and keep in sync.

Two layers are covered:

1. **Pure-function unit tests** — extraction quality scoring, chunking, file validation, and defensive JSON parsing.
2. **API route tests** — every route handler's input validation and error-to-HTTP-status mapping, with heavy dependencies mocked.

## 2. Running the Tests

```bash
npm test          # single run (CI-friendly)
npm run test:watch  # watch mode for development
```

A full verification pass before committing:

```bash
npx tsc --noEmit && npm test && npm run lint
```

## 3. Configuration

* `vitest.config.mts` — Vitest config. Includes all `lib/**/*.test.ts`, `app/**/*.test.ts`, and `components/**/*.test.{ts,tsx}` files; maps the `@/*` path alias used by the app.
* Node environment (no DOM) — sufficient because all tested logic is non-visual.

## 4. Test Files

### Pure-function unit tests (lib/)

| File | Covers | Notes |
|---|---|---|
| `lib/file-validation.test.ts` | `validateFile`, `formatFileSize`, `getFileTypeLabel`, `isImageFile` | Size limit boundary (exactly 10 MB passes), extension/MIME mismatch rejection, empty and `application/octet-stream` MIME fallbacks |
| `lib/extraction/text-quality.test.ts` | `analyzeTextQuality` | Empty/whitespace input, trustworthy English, SQL/code tolerance, OCR gibberish detection, replacement characters, score clamping to `[0, 1]` |
| `lib/summarization/chunking.test.ts` | `chunkText` | Empty input, 30k-character cap, paragraph-break preference over hard cuts, sentence-break fallback, sequential indices, content reconstruction across chunks |
| `lib/summarization/json-utils.test.ts` | `extractJson`, `toStringArray` | Code fences, closed/unclosed `<think>` blocks, prose-wrapped payloads, nested objects, braces inside strings, whitespace-only array entries |

### API route tests (app/api/)

Route handlers are called directly with constructed `Request` objects; responses are asserted on status code and JSON body.

| File | Endpoint | Key behaviors verified |
|---|---|---|
| `app/api/summarize/route.test.ts` | `POST /api/summarize` | Non-JSON body → 400; blank text → 400; length passthrough and fallback to `medium`; `SummarizationConfigError` → 500 `CONFIG_ERROR`; `SummarizationRequestError` → 502; unexpected errors → generic 500 that never leaks internals |
| `app/api/extract/route.test.ts` | `POST /api/extract` | Non-multipart body → 400; missing file → 400 `NO_FILE`; unsupported extension → 400; oversize → 413 `FILE_TOO_LARGE`; `EmptyExtractionError` → 422; PDF vs image source-type detection; generic → 500 |
| `app/api/qa/questions/route.test.ts` | `POST /api/qa/questions` | Validation, success payload shape, full config/request/generic error mapping |
| `app/api/qa/answer/route.test.ts` | `POST /api/qa/answer` | Text *and* question validation, argument forwarding to `answerQuestion`, error mapping |

## 5. Mocking Strategy

Route tests mock only the expensive or network-bound modules with `vi.mock`:

* `@/lib/extraction` — avoids loading pdf-parse/tesseract WASM bindings.
* `@/lib/summarization/index` — avoids real OpenRouter calls.
* `@/lib/qa` — same.

Mocked error classes are defined **inside** the `vi.mock` factory and imported by the test through the mocked module path. This keeps `instanceof` checks inside the route handlers consistent with what the tests throw.

Pure helpers such as `@/lib/file-validation` are deliberately **not** mocked in the extract-route tests: this exercises the real extension→400 / size→413 classification end-to-end.

Fixtures must match the real return types (`Summary`, `ExtractionResult`, `DocumentAnswer`) because `vi.mocked()` preserves the original function signatures — type errors surface at compile time when a fixture drifts from the actual contract.

## 6. Conventions for New Tests

1. Colocate the test file with the source: `module.ts` → `module.test.ts`.
2. One `describe` per exported function or endpoint; `it` names describe observable behavior.
3. Route tests follow the pattern: build request → `await POST(request)` → assert status + parsed body.
4. Assert error responses on both `status` and `error.code`; assert internal error details never appear in client-facing messages.
5. Keep fixtures typed against the real exported types rather than `any`.
