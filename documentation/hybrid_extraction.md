# Document Summarizer — V3 Documentation

## 1. Version

**Version:** V3 — Universal Document Extraction
**Status:** Complete
**Previous Version:** V2 — Basic PDF and Image Extraction

V3 introduces **page-level hybrid PDF extraction**, enabling the system to process text PDFs, scanned PDFs, mixed PDFs, and standalone images.

---

## 2. Overview

V3 uses the fastest suitable extraction method for each document:

* **Text PDF:** Native PDF text extraction
* **Scanned PDF:** PDF page rendering + OCR
* **Mixed PDF:** Native extraction for text pages and OCR for scanned pages
* **Image:** OCR

The key design principle is **OCR as a fallback, not the default**.

---

## 3. Architecture

```text
                    Uploaded Document
                           |
                           v
                  Server-side Validation
                           |
                    +------+------+
                    |             |
                   PDF          Image
                    |             |
                    v             v
             Page-level         OCR
              extraction
                    |
             +------+------+
             |             |
        Usable text      No text
             |             |
             v             v
            PDF       Render page
          extraction       |
                           v
                          OCR
             \             /
              +-----------+
                    |
                    v
             Combined Result
```

---

## 4. Hybrid PDF Extraction

Each PDF page is evaluated independently.

```text
PDF
 |
 +-- Page 1 --> Text available --> PDF extraction
 |
 +-- Page 2 --> Text available --> PDF extraction
 |
 +-- Page 3 --> No text --------> Render --> OCR
 |
 +-- Page 4 --> No text --------> Render --> OCR
 |
 +-- Page 5 --> Text available --> PDF extraction
 |
 v
Combined text in original page order
```

This allows digital pages and scanned pages to coexist in the same document without unnecessarily OCR-processing the entire PDF.

---

## 5. Extraction Components

### PDF Extraction

**File:** `lib/extraction/pdf.ts`

Uses `pdf-parse@2.4.5` to:

* Parse PDF files
* Extract page-level text
* Determine page count
* Cleanly release the parser after processing

### PDF Rendering

Scanned pages are rendered individually into raster images before OCR.

```text
PDF Page → Renderer → Image → Tesseract OCR → Text
```

### OCR

**File:** `lib/extraction/ocr.ts`

Uses **Tesseract.js** for image and rendered-PDF OCR.

The OCR worker is terminated after processing to prevent resource leaks.

### Unified Extraction Service

**File:** `lib/extraction/index.ts`

Provides a single interface to the application:

```text
extractDocumentText(buffer, sourceType)
```

It hides the underlying PDF, rendering, and OCR implementation from the UI/API.

---

## 6. Extraction Result

The extraction layer returns:

* Extracted text
* Page count
* Word count
* Character count
* Overall extraction method
* Per-page extraction method for hybrid PDFs

Supported methods:

```text
pdf
ocr
hybrid
```

---

## 7. API

**Route:** `app/api/extract/route.ts`

```http
POST /api/extract
```

Responsibilities:

1. Receive the uploaded file.
2. Validate it server-side.
3. Determine the document type.
4. Invoke the unified extraction service.
5. Return structured extraction results.
6. Return controlled error responses.

The route uses the **Node.js runtime** because PDF rendering and OCR require Node-compatible processing.

---

## 8. Validation & Error Handling

Server-side validation is performed independently of client-side validation.

```text
Client Validation
       |
     Upload
       |
       v
Server Validation
       |
       v
Extraction
```

Defined failure states:

| Condition          | Code                |
| ------------------ | ------------------- |
| No file            | `NO_FILE`           |
| Invalid file       | `INVALID_FILE`      |
| File too large     | `FILE_TOO_LARGE`    |
| Empty extraction   | `EMPTY_EXTRACTION`  |
| Unexpected failure | `EXTRACTION_FAILED` |

An empty extraction is never reported as a successful result.

---

## 9. Key Design Decisions

### Page-Level Hybrid Processing

OCR is selected per page rather than per document.

**Reason:** Real-world PDFs can contain both digital and scanned pages.

### Native Extraction Before OCR

Native PDF extraction is always attempted first.

**Reason:** It is faster, generally more accurate for digital text, and avoids unnecessary OCR.

### Render Before OCR

Scanned PDF pages are converted to images before being passed to Tesseract.

**Reason:** OCR operates on image data and scanned PDFs may have no usable text layer.

### Modular Extraction Layer

PDF parsing, rendering, OCR, and API handling are separated.

**Reason:** Improves maintainability, testing, and future extensibility.

### Server-Side Validation

Files are validated again on the server.

**Reason:** Client-side validation is not a security boundary.

---

## 10. Testing & Verification

The following checks passed:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

The complete extraction flow was also verified through the web application.

### Test Matrix

| Document         | Expected         | Result |
| ---------------- | ---------------- | ------ |
| Text PDF         | PDF              | Passed |
| Scanned PDF      | OCR              | Passed |
| Standalone image | OCR              | Passed |
| Mixed PDF        | Hybrid           | Passed |
| Invalid file     | Validation error | Passed |
| Oversized file   | Validation error | Passed |

A mixed PDF containing **2 text pages and 8 scanned pages** successfully produced:

```text
Method: hybrid
Pages: 10

Page 1:  pdf
Page 2:  pdf
Page 3:  ocr
Page 4:  ocr
Page 5:  ocr
Page 6:  ocr
Page 7:  ocr
Page 8:  ocr
Page 9:  ocr
Page 10: ocr
```

The final text preserved the original page order.

---

## 11. V2 → V3

### V2

```text
PDF
 |
 +--> Text PDF ------> PDF extraction
 |
 +--> Scanned PDF ---> Empty extraction
```

### V3

```text
PDF
 |
 +--> Page has text -------> PDF extraction
 |
 +--> Page has no text ----> Render --> OCR
 |
 +------------------------------+
                                |
                                v
                         Combined document
```

V3 resolves the primary V2 limitation: **scanned and mixed PDFs can now be extracted successfully.**

---

## 12. Dependencies

```json
{
  "pdf-parse": "^2.4.5",
  "tesseract.js": "^7.0.0"
}
```

These provide native PDF processing and OCR capabilities required by V3.

---

## 13. Outcome

V3 establishes a modular, server-side document extraction layer capable of handling **text PDFs, scanned PDFs, mixed PDFs, and standalone images**.

The architecture is now ready for the next stage of the project: **document summarization built on top of the unified extraction result.**
