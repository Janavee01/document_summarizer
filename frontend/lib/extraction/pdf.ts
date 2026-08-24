import { PDFParse } from "pdf-parse";

export type PdfPageExtractionResult = {
  pageNumber: number;
  text: string;
};

export type PdfExtractionResult = {
  pages: PdfPageExtractionResult[];
  pageCount: number;
};

/**
 * Extracts native text from every PDF page.
 *
 * This function intentionally does not perform OCR.
 * OCR decisions belong to the hybrid extraction pipeline.
 */
export async function extractPdfText(
  buffer: Buffer,
): Promise<PdfExtractionResult> {
  const parser = new PDFParse({
    data: buffer,
  });

  try {
    const result = await parser.getText({
      pageJoiner: "",
    });

    return {
      pages: result.pages.map((page) => ({
        pageNumber: page.num,
        text: page.text.trim(),
      })),
      pageCount: result.total,
    };
  } finally {
    await parser.destroy();
  }
}

/**
 * Renders one PDF page into a PNG image.
 *
 * The rendered image is used by the OCR pipeline when native
 * PDF text extraction is missing or suspicious.
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
      imageBuffer: true,
      imageDataUrl: false,
      scale: 1.5,
    });

    const page = result.pages[0];

    if (!page) {
      throw new Error(
        `Could not render PDF page ${pageNumber}.`,
      );
    }

    return Buffer.from(page.data);
  } finally {
    await parser.destroy();
  }
}