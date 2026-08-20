import { PDFParse } from "pdf-parse";

export type PdfPageText = {
  pageNumber: number;
  text: string;
};

export type PdfPageTextResult = {
  pages: PdfPageText[];
  pageCount: number;
};

export async function extractPdfPageTexts(
  buffer: Buffer,
): Promise<PdfPageTextResult> {
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
