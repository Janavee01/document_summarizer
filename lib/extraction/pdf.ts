import { PDFParse } from "pdf-parse";

export type PdfPageExtraction = {
  pageNumber: number;
  text: string;
};

export type PdfExtractionResult = {
  text: string;
  pageCount: number;
  pages: PdfPageExtraction[];
};

/**
 * Extracts text from every page of a PDF.
 *
 * Text is kept separately per page so the hybrid extraction pipeline
 * can identify pages that need OCR.
 */
export async function extractPdfText(
  buffer: Buffer,
): Promise<PdfExtractionResult> {
  const parser = new PDFParse({
    data: buffer,
  });

  try {
    const result = await parser.getText();

    const pages = result.pages.map((page) => ({
      pageNumber: page.num,
      text: page.text.trim(),
    }));

    const text = pages
      .map((page) => page.text)
      .filter(Boolean)
      .join("\n\n")
      .trim();

    return {
      text,
      pageCount: result.total,
      pages,
    };
  } finally {
    await parser.destroy();
  }
}

/**
 * Renders one PDF page as a PNG image.
 *
 * The resulting image can be passed directly to Tesseract.js for OCR.
 */
export async function renderPdfPage(
  buffer: Buffer,
  pageNumber: number,
): Promise<Buffer> {
  const parser = new PDFParse({
    data: buffer,
  });

  try {
    const result = await parser.getScreenshot({
      partial: [pageNumber],
      desiredWidth: 1600,
      imageBuffer: true,
      imageDataUrl: false,
    });

    const page = result.pages[0];

    if (!page?.data) {
      throw new Error(
        `Could not render PDF page ${pageNumber} as an image.`,
      );
    }

    return Buffer.from(page.data);
  } finally {
    await parser.destroy();
  }
}