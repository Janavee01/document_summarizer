import { extractImageText } from "./ocr";
import { extractHybridPdfText } from "./hybrid";

export type ExtractionMethod = "pdf" | "ocr";

export type PageExtractionMethod = "pdf" | "ocr";

export type ExtractedPage = {
  pageNumber: number;
  text: string;
  method: PageExtractionMethod;
};

export type ExtractionResult = {
  text: string;
  pages: ExtractedPage[];
  pageCount?: number;
  wordCount: number;
  characterCount: number;
  method: ExtractionMethod;
};

export type ExtractionSourceType = "pdf" | "image";

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

function determineOverallMethod(
  pages: ExtractedPage[],
): ExtractionMethod {
  const hasOcrPages = pages.some(
    (page) => page.method === "ocr",
  );

  return hasOcrPages ? "ocr" : "pdf";
}

export async function extractDocumentText(
  buffer: Buffer,
  sourceType: ExtractionSourceType,
): Promise<ExtractionResult> {
  /*
   * Images are always processed directly through OCR.
   */
  if (sourceType === "image") {
    const { text } = await extractImageText(buffer);

    if (!text) {
      throw new EmptyExtractionError(
        "No text could be detected in this image. " +
          "Try a clearer photo or a higher-resolution scan.",
      );
    }

    return {
      text,
      pages: [
        {
          pageNumber: 1,
          text,
          method: "ocr",
        },
      ],
      wordCount: countWords(text),
      characterCount: text.length,
      method: "ocr",
    };
  }

  /*
   * PDFs use the page-level hybrid extraction pipeline.
   *
   * Each page is first evaluated using native PDF extraction.
   * Suspicious pages are rendered and passed through OCR.
   */
  const hybridResult = await extractHybridPdfText(buffer);

  const text = hybridResult.text.trim();

  if (!text) {
    throw new EmptyExtractionError(
      "No readable text could be extracted from this PDF.",
    );
  }

  const pages: ExtractedPage[] = hybridResult.pages.map(
    (page) => ({
      pageNumber: page.pageNumber,
      text: page.text,
      method: page.method,
    }),
  );

  return {
    text,
    pages,
    pageCount: hybridResult.pageCount,
    wordCount: countWords(text),
    characterCount: text.length,
    method: determineOverallMethod(pages),
  };
}