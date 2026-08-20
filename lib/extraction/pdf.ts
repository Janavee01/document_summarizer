import { PDFParse } from "pdf-parse";

export type PdfExtractionResult = {
  text: string;
  pageCount: number;
};

export async function extractPdfText(
  buffer: Buffer,
): Promise<PdfExtractionResult> {
  const parser = new PDFParse({
    data: buffer,
  });

  try {
    const result = await parser.getText();

    const text = result.text.trim();

    return {
      text,
      pageCount: result.total,
    };
  } finally {
    await parser.destroy();
  }
}