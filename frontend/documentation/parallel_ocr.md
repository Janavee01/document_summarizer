# Parallel OCR (Worker-Pool Page Recognition)

## Overview

When the hybrid PDF pipeline decides that some pages need OCR (scanned or
suspicious pages), those pages are recognized **in parallel across a small
pool of Tesseract workers** instead of one-by-one on a single worker.

A single Tesseract worker can only run one recognition job at a time, so the
original implementation processed every OCR page sequentially — a 10-page
scanned PDF paid 10 full recognition passes back-to-back. With the pool,
pages are distributed round-robin across up to **4 workers**, cutting wall
time on multi-page scans by roughly the pool size (≈4x in the best case).

Extraction semantics are unchanged: same page selection rules, same
normalization, same combined output in original page order.

## How It Flows

# OCR Fallback Path — Parallel Worker Pool

```text
┌──────────────────────────────┐
│ Suspicious page numbers      │
│ collected                    │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ Create worker pool           │
│ size = min(pages, 4)         │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ Render suspicious pages      │
│ One render pass • 1.5× scale │
└──────────────┬───────────────┘
               │
               ▼
        ┌───────────────┐
        │ Distribute    │
        │ round-robin   │
        └───────┬───────┘
                │
       ┌────────┼────────┬────────┐
       │        │        │        │
       ▼        ▼        ▼        ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Worker 1 │ │ Worker 2 │ │ Worker 3 │ │ Worker 4 │
│ OCR      │ │ OCR      │ │ OCR      │ │ OCR      │
│ pages    │ │ pages    │ │ pages    │ │ pages    │
└─────┬────┘ └─────┬────┘ └─────┬────┘ └─────┬────┘
      │            │            │            │
      └────────────┼────────────┼────────────┘
                   │
                   ▼
        ┌────────────────────────┐
        │ Merge OCR results      │
        │ map keyed by page no.  │
        └────────────┬───────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │ Terminate all workers   │
        │        (finally)        │
        └────────────┬───────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │ Destroy PDF parser      │
        └────────────────────────┘
```

## Processing waves

```text
                  ┌──────────┐
                  │  Pages   │
                  └────┬─────┘
                       │
          ┌────────────┼────────────┐
          │            │            │
          ▼            ▼            ▼
     ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐
     │ Page 1 │   │ Page 2 │   │ Page 3 │   │ Page 4 │
     │   W1   │   │   W2   │   │   W3   │   │   W4   │
     └────┬───┘   └────┬───┘   └────┬───┘   └────┬───┘
          │            │            │            │
          └────────────┼────────────┼────────────┘
                       │
                       ▼
                 ┌──────────┐
                 │ Wave 1   │
                 └──────────┘


     ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐
     │ Page 5 │   │ Page 6 │   │ Page 7 │   │ Page 8 │
     │   W1   │   │   W2   │   │   W3   │   │   W4   │
     └────┬───┘   └────┬───┘   └────┬───┘   └────┬───┘
          │            │            │            │
          └────────────┼────────────┼────────────┘
                       │
                       ▼
                 ┌──────────┐
                 │ Wave 2   │
                 └──────────┘

        Wall time ≈ ⌈pages / 4⌉ waves
```


## Implementation

### Worker pool — `lib/extraction/ocr.ts`

| Export | Purpose |
| --- | --- |
| `createOcrWorkerPool(requestedSize)` | Creates `min(max(1, requested), 4)` workers sequentially; if any creation fails, already-created workers are terminated before rethrowing |
| `terminateOcrWorkers(workers)` | Terminates every worker via `Promise.allSettled`, so one stuck worker cannot prevent the rest from being cleaned up |
| `MAX_OCR_WORKERS = 4` | Hard cap — each worker owns a separate WASM instance plus language data, so the pool stays deliberately small |

Pool size formula: `Math.max(1, Math.min(requestedSize, MAX_OCR_WORKERS))`.
Requesting more pages than the cap clamps to the cap; requesting zero pages
still yields exactly one worker (the caller never requests a pool when there
is nothing to OCR).

### Distribution — `lib/extraction/hybrid.ts`

```ts
await Promise.all(
  screenshots.pages.map((page, position) => {
    const worker = ocrWorkers[position % ocrWorkers.length];
    return worker.recognize(Buffer.from(page.data)).then(({ data }) => {
      ocrByPage.set(page.pageNumber, normalizeExtractedText(data.text ?? ""));
    });
  })
);
```

* Pages are assigned `position % pool.length`, so each worker gets a fair
  share and no two assignments target the same busy worker.
* Results land in the same page-number-keyed map used before, so page order
  and downstream combination logic are untouched.
* The pool is created **before** rendering so a worker-startup failure fails
  fast, before spending time rendering pages.

### Unchanged paths

| Path | Behavior |
| --- | --- |
| All-native-text PDF | Fast path — no rendering, no OCR, no pool created |
| Standalone image | Single page → `extractImageText` with one worker, as before |
| Mixed PDF | Only suspicious pages enter the pool |

## Key Design Decisions

### Cap the pool at 4 workers

**Reason:** Every worker instantiates its own WASM runtime and English
language model. Beyond ~4 workers, memory cost grows while returns diminish —
recognition is CPU-bound and typical server instances have few effective
cores for WASM compute.

### Round-robin assignment instead of a task queue

**Reason:** The page list is known up front and workers are interchangeable.
Static round-robin keeps the code simple and deterministic; each worker
internally processes its assignments one at a time, so there is no risk of
overloading a single worker.

### Fail-fast pool creation with partial cleanup

**Reason:** Workers are created sequentially; if worker #3 of 4 fails to
start, workers #1–2 are terminated immediately rather than leaking WASM
instances from a doomed request.

### `Promise.allSettled` teardown

**Reason:** Cleanup must be unconditional and total. If one worker's
`terminate()` rejects, the others must still be released — otherwise a single
bad worker leaks every remaining one.

## Error Handling

| Situation | Behavior |
| --- | --- |
| Any worker fails to start | Already-created workers terminated, error propagates to `/api/extract` → `EXTRACTION_FAILED` |
| Recognition throws on one page | `Promise.all` rejects, whole extraction fails with a controlled error response (same contract as before) |
| Request aborted / route timeout | `finally` block still terminates every worker and destroys the parser — no leaked WASM instances |

## Testing & Verification

The following checks passed after the change:

```bash
npx tsc --noEmit
npm run lint
npm test        # 79 tests passed
```

Existing extraction tests are unaffected: page selection, normalization, and
result ordering did not change — only how many recognitions run concurrently.

## Dependencies

Unchanged — `tesseract.js@7.0.0`. The pool only changes *how many* Tesseract
workers exist concurrently, not the library or model used.
