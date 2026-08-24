# Document Summarizer — Project Documentation

## 1. Project Overview

**Project:** Document Summarizer
**Current Version:** V2
**Status:** V2 implemented and verified
**Next Version:** V3 — Universal Document Extraction with Scanned PDF OCR

Document Summarizer is a web application that accepts PDF and image documents, extracts their text, and prepares the content for intelligent summarization. Development is divided into versions so that each major layer can be implemented and validated independently.

## 2. Technology Stack

### Frontend

* Next.js 16.3.1
* React 19.2.8
* TypeScript 5
* Tailwind CSS 4
* Lucide React

### Backend

* Next.js App Router
* Next.js Route Handlers
* Node.js runtime

### Document Processing

* `pdf-parse` 2.4.5
* `tesseract.js` 7.0.0

### Development

* npm
* ESLint
* Git/GitHub
* `clsx`
* `tailwind-merge`

## 3. Project Structure

```text
document_summarizer/
├── app/
│   ├── api/
│   │   ├── extract/route.ts
│   │   ├── qa/
│   │   │   ├── answer/route.ts
│   │   │   └── questions/route.ts
│   │   └── summarize/route.ts
│   ├── error.tsx
│   ├── global-error.tsx
│   ├── globals.css
│   ├── history/page.tsx
│   ├── layout.tsx
│   ├── page.tsx
│   └── s/page.tsx
├── components/
│   ├── site-sidebar.tsx
│   ├── summary/
│   │   ├── document-qa.tsx
│   │   ├── export-buttons.tsx
│   │   ├── summary-panel.tsx
│   │   └── summary-view.tsx
│   └── ui/
│       ├── button.tsx
│       ├── loading-progress.tsx
│       └── utils.ts
├── lib/
│   ├── extraction/
│   │   ├── hybrid.ts
│   │   ├── index.ts
│   │   ├── ocr.ts
│   │   ├── pdf-pages.ts
│   │   ├── pdf.ts
│   │   ├── text-normalization.ts
│   │   └── text-quality.ts
│   ├── qa/
│   │   ├── index.ts
│   │   └── retrieval.ts
│   ├── summarization/
│   │   ├── chunking.ts
│   │   ├── index.ts
│   │   ├── json-utils.ts
│   │   └── openrouter.ts
│   ├── clipboard.ts
│   ├── file-validation.ts
│   ├── history.ts
│   ├── share.ts
│   ├── summary-export.ts
│   ├── summary-pdf.ts
│   ├── summary-validation.ts
│   ├── use-creeping-progress.ts
│   └── utils.ts
├── types/
│   ├── document.ts
│   └── summary.ts
├── public/
├── .env.example
├── README.md
├── package.json
├── next.config.ts
├── tsconfig.json
└── eslint.config.mjs
```

## 4. Version History

### V0 — Project Foundation

**Status:** Complete

V0 established the initial application interface.

**Implemented:**

* Next.js App Router foundation
* Branding and landing page
* Responsive layout
* Upload panel and file picker
* Drag-and-drop support
* Drag-over and focus states
* Keyboard accessibility using Enter and Space

At this stage, uploading did not perform document extraction.

**Validation:**

```bash
npm run dev
npx tsc --noEmit
npx eslint .
npm run build
```

### V1 — Upload and File Handling

**Status:** Complete

V1 converted the interface into a functional file-selection workflow.

**Supported formats:** PDF, PNG, JPG, JPEG
**Maximum size:** 10 MB

**Implemented:**

* Reusable file validation
* File picker and drag-and-drop
* Keyboard-accessible upload
* Selected-file display
* File name, type, and size information
* Image previews
* PDF file icon
* Remove and replace actions

Invalid files are rejected before entering the selected-file state.

### V2 — Text Extraction and OCR

**Status:** Implemented

V2 introduced the backend extraction pipeline and a unified API for PDFs and standalone images.

```text
Browser
   │
   │ multipart/form-data
   ▼
POST /api/extract
   │
   ▼
Server-side validation
   │
   ▼
Unified extraction service
   │
   ├──────────────┐
   ▼              ▼
  PDF           Image
   │              │
   ▼              ▼
pdf-parse     Tesseract.js
   │              │
   └──────┬───────┘
          ▼
Normalized result
          │
          ▼
       Browser
```

## 5. PDF Extraction

**File:** `lib/extraction/pdf.ts`

PDF text extraction uses `pdf-parse@2.4.5` and its current `PDFParse` API.

```ts
new PDFParse({ data: buffer })
```

The parser extracts:

* document text
* page count

The parser is explicitly destroyed after processing to release resources.

## 6. Image OCR

**File:** `lib/extraction/ocr.ts`

Standalone images are processed using `tesseract.js@7.0.0`.

```text
Image Buffer
     ↓
Tesseract Worker
     ↓
English OCR
     ↓
Extracted Text
     ↓
Worker Terminated
```

OCR runs through Tesseract.js without requiring a system-level Tesseract installation.

## 7. Unified Extraction Service

**File:** `lib/extraction/index.ts`

The application exposes one extraction interface:

```ts
extractDocumentText(buffer, sourceType)
```

where:

```ts
sourceType = "pdf" | "image"
```

This keeps the rest of the application independent of the underlying extraction libraries.

The normalized result is:

```ts
{
  text: string;
  pageCount?: number;
  wordCount: number;
  characterCount: number;
  method: "pdf" | "ocr";
}
```

This provides a consistent representation regardless of the original file type.

## 8. Empty Extraction Handling

V2 introduced:

```text
EmptyExtractionError
```

This distinguishes successful extraction from successful processing that produced no usable text.

For example:

```text
Scanned PDF
    ↓
pdf-parse
    ↓
No meaningful text
    ↓
EmptyExtractionError
```

This prevents documents with no extractable content from being incorrectly reported as successfully processed.

## 9. Extraction API

**Endpoint:**

```text
POST /api/extract
```

**File:** `app/api/extract/route.ts`

The endpoint accepts a multipart form containing a `file`.

Server-side validation independently checks:

* file presence
* supported file type
* maximum file size

### Error Codes

```text
NO_FILE
INVALID_FILE
FILE_TOO_LARGE
EMPTY_EXTRACTION
EXTRACTION_FAILED
```

### Success Response

```json
{
  "success": true,
  "data": {
    "text": "...",
    "pageCount": 2,
    "wordCount": 100,
    "characterCount": 600,
    "method": "pdf"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "EMPTY_EXTRACTION",
    "message": "..."
  }
}
```

## 10. Runtime Configuration

The extraction route uses the Node.js runtime:

```ts
export const runtime = "nodejs";
export const maxDuration = 60;
```

`pdf-parse` and `tesseract.js` are configured as server external packages in `next.config.ts` to avoid Node/WASM bundling issues.

## 11. V2 Verification

The implementation was verified using development, type-checking, linting, build, and functional tests.

| Test             | Result                          |
| ---------------- | ------------------------------- |
| Normal PDF       | PASS — text extracted           |
| Standalone image | PASS — OCR extracted text       |
| Image-based PDF  | PARTIAL — requires OCR fallback |
| TypeScript       | PASS                            |
| ESLint           | PASS — 0 errors, 1 warning      |
| Production build | PASS                            |

The remaining ESLint warning is `@next/next/no-img-element`, related to the browser-generated image preview and currently non-blocking.

## 12. Current V2 Limitation

The main V2 limitation is **scanned/image-based PDFs**.

Normal PDFs work as expected:

```text
Text PDF
   ↓
pdf-parse
   ↓
Meaningful text
   ↓
Successful extraction
```

Standalone images use OCR:

```text
Image
   ↓
Tesseract.js
   ↓
Extracted text
```

However, scanned PDFs are currently passed to `pdf-parse`. Since their pages contain images rather than machine-readable text, the parser may return only small amounts of metadata or non-content text.

Testing showed that a two-page image-based PDF could return approximately:

```text
2 pages
10 words
28 characters
```

even though meaningful text was visible in the page images.

Therefore, checking only whether extracted text is completely empty is insufficient. The system must determine whether the extracted text is **meaningful** before deciding that PDF extraction succeeded.

## 13. V3 — Universal Document Extraction

**Status:** Implemented

V3 introduces **page-level hybrid PDF extraction**, allowing text PDFs, scanned PDFs, and mixed PDFs to be processed through the appropriate method.

```text
                    Document
                       │
              ┌────────┴────────┐
              ▼                 ▼
             PDF              Image
              │                 │
              ▼                 ▼
          pdf-parse          Tesseract
              │                 │
              ▼                 │
       Meaningful text?          │
          │       │              │
         Yes      No             │
          │       │              │
          │       ▼              │
          │   Render PDF pages   │
          │       │              │
          │       ▼              │
          │   Page images        │
          │       │              │
          │       ▼              │
          │   Tesseract OCR ◄────┘
          │       │
          └───┬───┘
              ▼
      Normalized result
              │
              ▼
           Browser
```

For each PDF page, the system determines whether usable text is available:

```text
PDF Page
   ↓
Text extraction
   ↓
Meaningful text?
 ┌─┴─────────┐
Yes          No
 │            │
 ▼            ▼
Use text   Render page
              ↓
           OCR page
              ↓
        Use OCR text
```

This page-level approach also supports **mixed PDFs**, where some pages contain normal text and others are scanned.

The goal is to make extraction transparent to the user: regardless of whether the source is a text PDF, scanned PDF, mixed PDF, or standalone image, the system should return the best available textual representation.

## 14. Version Roadmap

```text
V0
Project Foundation
      ↓
V1
Upload & File Handling
      ↓
V2
PDF Text Extraction + Image OCR
      ↓
V3
Universal / Hybrid Document Extraction
      ↓
Future
Text Quality + AI Summarization
```

The extraction layer is the foundation for the subsequent summarization system. Once reliable text is obtained from all supported document types, the complete extracted content can be passed to the chunked AI summarization pipeline.
