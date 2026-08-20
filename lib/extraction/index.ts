import { extractPdfText } from "./pdf";
import { extractImageText } from "./ocr";
import { extractPdfOcrText } from "./pdf-ocr";

export type ExtractionMethod = "pdf" | "ocr";

export type ExtractionResult = {
  text: string;
  pageCount?: number;
  wordCount: number;
  characterCount: number;
  method: ExtractionMethod;
};

export type ExtractionSourceType = "pdf" | "image";

/**
 * Thrown when extraction technically "succeeded" but produced no usable
 * text (e.g. a scanned PDF with no text layer). Kept distinct from generic
 * failures so the API route/UI can show a specific, honest message instead
 * of reporting success with an empty document.
 */
export class EmptyExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmptyExtractionError";
  }
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Single entry point for text extraction. The rest of the app only needs
 * to know "pdf" vs "image" — it never has to care whether that resolves to
 * pdf-parse or Tesseract.js under the hood.
 */
export async function extractDocumentText(
  buffer: Buffer,
  sourceType: ExtractionSourceType
): Promise<ExtractionResult> {

if (sourceType === "pdf") {
  const { text, pageCount } = await extractPdfText(buffer);

  if (text) {
    return {
      text,
      pageCount,
      wordCount: countWords(text),
      characterCount: text.length,
      method: "pdf",
    };
  }

  // No selectable text means this is likely a scanned/image-based PDF.
  // Fall back to rendering each page and running OCR.
  const ocrResult = await extractPdfOcrText(buffer);

  if (!ocrResult.text) {
    throw new EmptyExtractionError(
      "No text could be detected in this PDF. It may contain blank pages, very low-quality scans, or unsupported content.",
    );
  }

  return {
    text: ocrResult.text,
    pageCount: ocrResult.pageCount,
    wordCount: countWords(ocrResult.text),
    characterCount: ocrResult.text.length,
    method: "ocr",
  };
}

  const { text } = await extractImageText(buffer);

  if (!text) {
    throw new EmptyExtractionError(
      "No text could be detected in this image. Try a clearer photo or a higher-resolution scan."
    );
  }

  return {
    text,
    wordCount: countWords(text),
    characterCount: text.length,
    method: "ocr",
  };
}
