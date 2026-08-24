# New Features

## 1. Abstraction

The codebase is layered so that each concern can change without rippling
through the rest of the app.

```
app/                        Routing + HTTP boundary
  page.tsx                  Upload screen (presentation only)
  history/page.tsx          Dashboard screen (presentation only)
  s/page.tsx                Shared-summary viewer
  api/extract/route.ts      Backend text extraction endpoint
  api/summarize/route.ts    Backend LLM summarization endpoint
  api/qa/*/route.ts         Q&A endpoints

lib/                        Pure(ish) domain logic, no React
  extraction/               PDF parsing + OCR pipeline (pdf-parse, tesseract)
  summarization/            Chunking + OpenRouter LLM client
  file-validation.ts        Shared upload validation (extension/MIME/size)
  share.ts                  Self-contained share links (URL fragment)
  history.ts                localStorage persistence layer
  summary-export.ts         TXT/MD export builders + download helper
  summary-pdf.ts            PDF export builder (jsPDF)
  use-creeping-progress.ts  Progress-bar animation hook

components/                 UI layer
  site-sidebar.tsx          App-wide navigation shell
  ui/loading-progress.tsx   Generic integer progress bar
  upload/                   File selection presentation
  summary/                  SummaryPanel orchestrator, SummaryView,
                            DocumentQa, ExportButtons

types/                      Shared TypeScript contracts
  summary.ts                Summary shape, SummaryLength union
```

### Key abstractions

- **API boundary.** The browser never talks to pdf-parse, tesseract.js or
  OpenRouter directly. Extraction and generation happen behind `/api/*`
  routes (`runtime = "nodejs"`), which validate every request server-side
  (`validateFile`) and normalize errors into `{ success, error: { code,
  message } }` envelopes. Clients only ever see safe error messages.

- **Pipeline orchestration.** `SummaryPanel` owns a single `Phase` state
  machine — `idle → extracting → summarizing → success | error`. It hides the
  extraction step entirely: on "Generate summary" it POSTs the file to
  `/api/extract`, caches the resulting text in state, and immediately feeds it
  to `/api/summarize`. Retries skip re-extraction when cached text exists;
  length changes reuse it too.

- **Pure builders.** Export content is produced by pure functions
   (`buildPlainTextExport`, `buildMarkdownExport`, `buildSummaryPdf`) that
  take `(Summary, ExportMeta)` and return bytes/strings — trivially testable
  and reusable from both the live panel and history entries.

- **Shared contracts.** Everything crossing a layer boundary is typed in
  `types/summary.ts` and re-validated defensively at read boundaries (e.g.
  `loadHistory` validates each stored entry before trusting it).

---

## 2. History

Every successful summary is saved automatically — no explicit "save" action.

### Storage design (`lib/history.ts`)

| Aspect    | Decision                                                                 |
| --------- | ------------------------------------------------------------------------ |
| Backend   | Browser `localStorage` (no account system, nothing leaves the device)     |
| Key       | `document-intelligence.history.v1` — versioned so future schema changes can migrate |
| Entry     | `{ id, createdAt, fileName, sourceTypeLabel, length, sourceWordCount, summary }` |
| Order     | Newest first (`createdAt` descending)                                     |
| Cap       | 100 entries; oldest are dropped on overflow                               |

### Robustness rules

1. **Validate on read.** `loadHistory()` deep-validates every entry (all
   string arrays present, valid length enum, etc.). Corrupt or unknown shapes
   are dropped; if the whole blob is corrupt, storage self-heals by clearing
   the key instead of crashing the dashboard.
2. **Best-effort writes.** Quota errors or private-mode failures never break
   the UX — saving is fire-and-forget with in-memory state as source of truth
   for the current session.
3. **SSR-safe.** All functions guard on `typeof window`; ids use
   `crypto.randomUUID()` with a fallback generator.

### Dashboard (`app/history/page.tsx`)

- Stat cards: total summaries, distinct documents, last activity timestamp.
- Entry cards show title, document type, length badge, timestamp, source
  file name and source word count, plus a two-line snippet.
- Per-entry actions: expand/collapse the full `SummaryView`, inline export
  buttons, two-click delete confirmation ("Sure?") — no native dialogs.

Privacy note: summaries live only in the user's browser. Share links are also
client-side only — the payload is base64url-encoded into the URL *fragment*
(`#d=…`), which browsers never send to servers.

---

## 3. Exports

Three formats, available both right after generation and from any history
entry via `ExportButtons`.

### Plain text (`.txt`) — `buildPlainTextExport`

- Title underlined with `=`; sections (`SUMMARY`, `KEY POINTS`, …)
  underlined with `-`.
- Bullets use `•`; entities render as a comma-separated list.
- Meta header records document type, source file, summary length and
  generation time. UTF-8 encoded.

### Markdown (`.md`) — `buildMarkdownExport`

- `# Title`, meta as a bullet list, `## Section` headings, `-` bullets.
- Multi-line bullets keep continuation lines indented so lists stay stable.
- Paragraph structure survives: blank lines become real paragraphs and single
  newlines become Markdown hard breaks (`  \n`) instead of merging into one
  run-on line.
- Entities are rendered as inline code chips separated by `·`;
  `*` in meta values is escaped.

### PDF — `buildSummaryPdf` / `exportSummaryPdf` (jsPDF)

- A4, Helvetica, 56pt margins; generated fully client-side (the document
  content never round-trips through a server).
- Layout primitives: `writeWrapped` (text wrapping via `splitTextToSize`),
  `writeSectionHeading`, `writeBullets` (hanging indent under a bold bullet),
  and `ensureSpace`, which transparently starts a new page whenever content
  would cross the bottom margin.
- Meta block printed in gray above a divider rule.

### Download mechanics

Text exports go through `downloadTextFile`: `Blob` → object URL → temporary
anchor click → revoke. Filenames are derived from the summary title via
`slugifyFileName` (`q3-financial-review.pdf`). Export failures surface as an
inline alert rather than throwing.

---

## 4. Mobile responsiveness

The layout is mobile-first: base styles target small screens, with
progressive enhancement at Tailwind's `sm:` (640px) and `lg:` (1024px)
breakpoints.

### Navigation shell (`components/site-sidebar.tsx`)

- **Desktop (≥ lg):** fixed vertical rail on the left (`w-60`, full height).
  The page content column reserves space via `lg:pl-60` on the layout wrapper,
  so nothing ever slides underneath the rail.
- **Mobile/tablet (< lg):** the rail is replaced by a sticky top bar
  (brand + hamburger). Tapping the hamburger opens a slide-in drawer
  (`w-72 max-w-[85vw]`) over a dimmed backdrop:
  - closes on backdrop tap, ✕ button, route change, or <kbd>Esc</kbd>;
  - locks body scroll while open;
  - `aria-expanded`, `role="dialog"`, `aria-modal` for assistive tech.

### Page-level adaptations

| Area | Mobile behavior |
| --- | --- |
| Home file chip | Stacks vertically below `sm:`; "Choose another file" stretches full-width next to the remove button |
| Drop zone | Fluid padding (`p-8 sm:p-12`), full tap/click/drag target |
| Summary card header | Length toggle wraps below the title row; buttons disable while generating |
| Summary actions (Export/Copy/Share/Regenerate) | Wrap onto multiple rows (`flex-wrap`) instead of overflowing; align left on mobile, right on desktop |
| Progress bars | Full-width fluid bars with integer % labels |
| Q&A | Chips wrap freely; input keeps a flexible `min-w-0` so the Ask button never gets pushed off-screen |
| History stats | 1-column grid on phones → 3 columns at `sm:` |
| History cards | Header stacks (info above action buttons) below `sm:`; badges/timestamps wrap |
| Typography | Headings scale `text-2xl → sm:text-3xl`; body copy stays ≥ 14px |

Touch targets across nav, cards, and export buttons are ≥ 36–40px, and all
interactive elements keep visible `focus-visible` rings for keyboard users.

```
