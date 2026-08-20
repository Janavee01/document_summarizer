# Document Summarizer — Project Documentation

## 1. Project Overview

**Project:** Document Summarizer
**Current Version:** V2
**Status:** V2 implemented; functional verification in progress
**Next Version:** V3 — Universal Document Extraction with Scanned PDF OCR

Document Summarizer is a web application that accepts PDF and image documents, extracts their textual content, and prepares the extracted content for intelligent summarization.

The project is being developed incrementally, with each version introducing and validating a distinct layer of functionality.

---

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

### Utilities & Development

* `clsx`
* `tailwind-merge`
* npm
* ESLint
* Git/GitHub

---

## 3. Project Structure

```text
document_summarizer/
│
├── app/
│   ├── api/
│   │   └── extract/
│   │       └── route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   └── upload/
│       └── document-reader.tsx
│
├── lib/
│   ├── extraction/
│   │   ├── index.ts
│   │   ├── ocr.ts
│   │   └── pdf.ts
│   └── file-validation.ts
│
├── types/
│   ├── document.ts
│   └── summary.ts
│
├── public/
├── .env.example
├── README.md
├── DOCUMENTATION.md
├── package.json
├── next.config.ts
├── tsconfig.json
└── eslint.config.mjs
```

---

# 4. Version History

## V0 — Project Foundation

**Status:** Complete

V0 established the initial frontend foundation.

### Implemented

* Next.js App Router application
* Application branding and landing page
* Responsive layout
* Upload panel
* File picker interaction
* Drag-and-drop interaction
* Drag-over visual state
* Keyboard accessibility using Enter and Space
* Focus states

At this stage, the upload interface did **not** perform document extraction.

### Validation

The application was validated using:

```bash
npm run dev
npx tsc --noEmit
npx eslint .
npm run build
```

---

## V1 — Upload and File Handling

**Status:** Complete

V1 converted the initial upload interface into a functional client-side document selection workflow.

### Supported Files

* PDF
* PNG
* JPG
* JPEG

### File Limit

* Maximum size: **10 MB**

### Implemented

* Reusable file validation through `lib/file-validation.ts`
* Browser file picker
* Drag-and-drop
* Drag-over feedback
* Keyboard-accessible upload
* Selected-file display
* File name, type, and size information
* Image previews using browser object URLs
* PDF file icon
* Remove document
* Replace document

The file input was kept in a stable location so that replacing a selected document continues to work correctly.

### V1 Workflow

```text
┌─────────┐
│  Idle   │
└────┬────┘
     │
     ▼
┌───────────────┐
│ File Selected │
└──────┬────────┘
       │
       ▼
┌───────────────┐
│ File Displayed│
└──────┬────────┘
       │
       ├──────────────┐
       ▼              ▼
   Replace          Remove
       │              │
       └──────► Idle ◄┘
```

Invalid files produce validation errors instead of entering the selected-file state.

---

# 5. V2 — Text Extraction and OCR

**Status:** Implemented

V2 introduced the backend document-processing pipeline.

The application now provides a unified extraction endpoint for PDFs and standalone images.

## V2 Architecture

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
              ┌─────┴─────┐
              │           │
              ▼           ▼
             PDF        Image
              │           │
              ▼           ▼
          pdf-parse   Tesseract.js
              │           │
              └─────┬─────┘
                    ▼
          Normalized extraction
                    │
                    ▼
                 Browser
```

The API route is separated from the extraction implementation so that document-processing libraries can be changed or extended without coupling the frontend to them.

---

## 6. PDF Extraction

**File:** `lib/extraction/pdf.ts`

PDF text extraction uses:

```text
pdf-parse@2.4.5
```

The current package API uses:

```ts
import { PDFParse } from "pdf-parse";
```

### Processing Flow

```text
PDF Buffer
    │
    ▼
new PDFParse({ data: buffer })
    │
    ▼
getText()
    │
    ├── Extracted text
    └── Page count
    │
    ▼
Parser destroyed
```

The parser is explicitly destroyed after processing to avoid retaining resources.

The PDF extraction result provides:

```ts
{
  text: string;
  pageCount: number;
}
```

---

# 7. Image OCR

**File:** `lib/extraction/ocr.ts`

Standalone image OCR uses:

```text
tesseract.js@7.0.0
```

The current OCR language is English.

### Processing Flow

```text
Image Buffer
     │
     ▼
Tesseract Worker
     │
     ▼
English OCR
     │
     ▼
Extracted Text
     │
     ▼
Worker Terminated
```

Tesseract.js performs OCR without requiring a system-level Tesseract installation.

---

# 8. Unified Extraction Service

**File:** `lib/extraction/index.ts`

The application exposes a single extraction interface:

```ts
extractDocumentText(buffer, sourceType)
```

where:

```ts
sourceType = "pdf" | "image"
```

This abstraction prevents the rest of the application from depending directly on `pdf-parse` or Tesseract.

---

# 9. Normalized Extraction Result

The extraction service normalizes results into a common structure:

```ts
{
  text: string;
  pageCount?: number;
  wordCount: number;
  characterCount: number;
  method: "pdf" | "ocr";
}
```

### Metadata

* `text` — extracted document content
* `pageCount` — available for PDFs
* `wordCount` — number of whitespace-separated words
* `characterCount` — number of extracted characters
* `method` — extraction method used

For normal PDFs:

```text
method = "pdf"
```

For image OCR:

```text
method = "ocr"
```

---

# 10. Empty Extraction Handling

V2 introduced:

```text
EmptyExtractionError
```

This distinguishes between:

1. Successful extraction containing usable text
2. Successful processing that produced no usable text

This distinction is important for scanned documents.

For example:

```text
Scanned PDF
     │
     ▼
  pdf-parse
     │
     ▼
No meaningful text
     │
     ▼
EmptyExtractionError
```

The application does not incorrectly report such a document as successfully extracted.

---

# 11. API

**Endpoint:**

```text
POST /api/extract
```

**File:**

```text
app/api/extract/route.ts
```

The endpoint accepts a multipart form containing:

```text
file
```

## Server-Side Validation

The API validates the uploaded file independently of client-side validation using:

```ts
validateFile()
```

Validation includes:

* File presence
* Supported file type
* Maximum file size

## Error Codes

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

---

# 12. Runtime Configuration

The extraction route uses the Node.js runtime:

```ts
export const runtime = "nodejs";
```

The route also allows additional processing time:

```ts
export const maxDuration = 60;
```

`pdf-parse` and `tesseract.js` are configured as server external packages in `next.config.ts` to avoid bundling issues associated with their Node/WASM-related behavior.

---

# 13. V2 Verification

The following checks have been performed:

### Development Server

```bash
npm run dev
```

Application successfully runs at:

```text
http://localhost:3000
```

### TypeScript

```bash
npx tsc --noEmit
```

**Result:** PASS

The initial outdated `pdf-parse` default import was replaced with the current `PDFParse` API.

### ESLint

```bash
npm run lint
```

**Result:** 0 errors, 1 warning

The remaining warning is:

```text
@next/next/no-img-element
```

It relates to the browser-generated image preview and is currently non-blocking.

### Production Build

```bash
npm run build
```

**Result:** PASS

---

# 14. Functional Test Results

| Test             | Result  | Notes                                      |
| ---------------- | ------- | ------------------------------------------ |
| Normal PDF       | PASS    | Text successfully extracted                |
| Standalone image | PASS    | Tesseract successfully extracted text      |
| Image-based PDF  | PARTIAL | PDF parser returns little non-content text |
| TypeScript       | PASS    | No TypeScript errors                       |
| ESLint           | PASS    | 0 errors, 1 warning                        |
| Production build | PASS    | Build completes successfully               |

---

# 15. Current V2 Limitation

The primary limitation is scanned or image-based PDFs.

A normal PDF follows:

```text
Text PDF
   │
   ▼
pdf-parse
   │
   ▼
Meaningful text
   │
   ▼
Successful extraction
```

A standalone image follows:

```text
Image
   │
   ▼
Tesseract.js
   │
   ▼
Successful OCR
```

However, an image-based PDF currently follows:

```text
Image-based PDF
      │
      ▼
   pdf-parse
      │
      ▼
Little or no meaningful text
      │
      ▼
May be incorrectly treated as
successful PDF extraction
```

Testing showed that a two-page image-based PDF could produce metadata such as:

```text
2 pages
10 words
28 characters
```

even though the meaningful text inside the images was not extracted.

Therefore, checking only whether the extracted text is completely empty is insufficient.

---

# 16. V3 — Universal Document Extraction

**Status:** Planned

V3 will improve extraction by detecting whether a PDF contains meaningful machine-readable text.

## Target Architecture

```text
                    Document
                       │
              ┌────────┴────────┐
              │                 │
              ▼                 ▼
             PDF              Image
              │                 │
              ▼                 ▼
          pdf-parse          Tesseract
              │                 │
              ▼                 │
     Meaningful text?            │
         │       │               │
        Yes      No              │
         │       │               │
         │       ▼               │
         │   Render PDF pages    │
         │       │               │
         │       ▼               │
         │   Page images         │
         │       │               │
         │       ▼               │
         │   Tesseract OCR ◄─────┘
         │       │
         └───┬───┘
             ▼
      Normalized result
             │
             ▼
          Browser
```

## V3 Behavior

### Text PDF

```text
PDF
 │
 ▼
pdf-parse
 │
 ▼
Meaningful text detected
 │
 ▼
Return PDF extraction
```

### Scanned PDF

```text
PDF
 │
 ▼
pdf-parse
 │
 ▼
Insufficient meaningful text
 │
 ▼
Render pages as images
 │
 ▼
Tesseract OCR
 │
 ▼
Combine page text
 │
 ▼
Return OCR extraction
```

### Standalone Image

```text
Image
 │
 ▼
Tesseract OCR
 │
 ▼
Return OCR extraction
```

The goal of V3 is to make the extraction layer transparent to the user: regardless of whether the source is a text PDF, scanned PDF, or standalone image, the application should return the best available textual representation.

---

# 17. Version Roadmap

```text
V0
Project Foundation
     │
     ▼
V1
Upload & File Handling
     │
     ▼
V2
PDF Text Extraction + Image OCR
     │
     ▼
V3
Universal Extraction + Scanned PDF OCR
     │
     ▼
Future
Text Cleaning + Summarization
```

The immediate development priority is V3 scanned-PDF detection and OCR fallback. Once reliable document extraction is established, the extracted content can be passed to the summarization layer.
