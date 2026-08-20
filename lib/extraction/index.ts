import {
  extractPdfText,
  renderPdfPage,
} from "./pdf";

import {
  createOcrWorker,
  extractImageText,
  recognizeWithWorker,
} from "./ocr";

export type ExtractionMethod = "pdf" | "ocr" | "hybrid";

export type ExtractionSourceType = "pdf" | "image";

export type PageExtractionMethod = "pdf" | "ocr";

export type PageExtractionResult = {
  pageNumber: number;
  text: string;
  method: PageExtractionMethod;
};

export type ExtractionResult = {
  text: string;
  pageCount?: number;
  wordCount: number;
  characterCount: number;
  method: ExtractionMethod;
  pages?: PageExtractionResult[];
};

/**
 * Thrown when extraction technically succeeded but produced no usable text.
 */
export class EmptyExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmptyExtractionError";
  }
}

function countWords(text: string): number {
  const trimmed = text.trim();

  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).length;
}

function createExtractionResult(
  text: string,
  method: ExtractionMethod,
  pageCount?: number,
  pages?: PageExtractionResult[],
): ExtractionResult {
  const normalizedText = text.trim();

  return {
    text: normalizedText,
    pageCount,
    wordCount: countWords(normalizedText),
    characterCount: normalizedText.length,
    method,
    pages,
  };
}

/**
 * Determines whether a PDF page contains enough extracted text
 * to be considered a text-based page.
 *
 * Very small amounts of text can come from metadata, page numbers,
 * headers, or other non-content elements, so we use a small threshold
 * instead of checking only for an empty string.
 */
function hasMeaningfulText(text: string): boolean {
  const normalizedText = text.trim();

  return normalizedText.length >= 20;
}

/**
 * Extracts a PDF using a hybrid PDF-text/OCR strategy.
 *
 * Text-based pages use the native PDF text layer.
 * Pages without meaningful text are rendered to images and OCRed.
 */
async function extractHybridPdf(
  buffer: Buffer,
): Promise<ExtractionResult> {
  const pdfResult = await extractPdfText(buffer);

  const requiresOcr = pdfResult.pages.some(
    (page) => !hasMeaningfulText(page.text),
  );

  if (!requiresOcr) {
    return createExtractionResult(
      pdfResult.text,
      "pdf",
      pdfResult.pageCount,
      pdfResult.pages.map((page) => ({
        pageNumber: page.pageNumber,
        text: page.text,
        method: "pdf",
      })),
    );
  }

  const ocrWorker = await createOcrWorker();

  try {
    const extractedPages: PageExtractionResult[] = [];

    for (const page of pdfResult.pages) {
      if (hasMeaningfulText(page.text)) {
        extractedPages.push({
          pageNumber: page.pageNumber,
          text: page.text,
          method: "pdf",
        });

        continue;
      }

      const pageImage = await renderPdfPage(
        buffer,
        page.pageNumber,
      );

      const ocrResult = await recognizeWithWorker(
        ocrWorker,
        pageImage,
      );

      extractedPages.push({
        pageNumber: page.pageNumber,
        text: ocrResult.text,
        method: "ocr",
      });
    }

    const combinedText = extractedPages
      .map((page) => page.text)
      .filter(Boolean)
      .join("\n\n")
      .trim();

    if (!combinedText) {
      throw new EmptyExtractionError(
        "No text could be extracted from this PDF. It may contain images that OCR could not read.",
      );
    }

    const hasPdfPages = extractedPages.some(
      (page) => page.method === "pdf",
    );

    const hasOcrPages = extractedPages.some(
      (page) => page.method === "ocr",
    );

    let method: ExtractionMethod = "hybrid";

    if (!hasPdfPages && hasOcrPages) {
      method = "ocr";
    }

    return createExtractionResult(
      combinedText,
      method,
      pdfResult.pageCount,
      extractedPages,
    );
  } finally {
    await ocrWorker.terminate();
  }
}

/**
 * Unified document extraction service.
 *
 * Images use OCR directly.
 * PDFs use native PDF extraction with OCR fallback for scanned pages.
 */
export async function extractDocumentText(
  buffer: Buffer,
  sourceType: ExtractionSourceType,
): Promise<ExtractionResult> {
  if (sourceType === "pdf") {
    return extractHybridPdf(buffer);
  }

  const { text } = await extractImageText(buffer);

  if (!text) {
    throw new EmptyExtractionError(
      "No text could be detected in this image. Try a clearer photo or a higher-resolution scan.",
    );
  }

  return createExtractionResult(text, "ocr");
}