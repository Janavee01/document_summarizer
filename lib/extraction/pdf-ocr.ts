import { PDFParse } from "pdf-parse";
import { createWorker } from "tesseract.js";

export type PdfOcrResult = {
  text: string;
  pageCount: number;
};

export async function extractPdfOcrText(
  buffer: Buffer,
): Promise<PdfOcrResult> {
  const parser = new PDFParse({
    data: buffer,
  });

  const worker = await createWorker("eng");

  try {
    const screenshots = await parser.getScreenshot({
      imageBuffer: true,
      scale: 1.5,
    });

    const pageTexts: string[] = [];

    for (const page of screenshots.pages) {
      const {
        data: { text },
      } = await worker.recognize(Buffer.from(page.data));

      const cleanedText = (text ?? "").trim();

      if (cleanedText) {
        pageTexts.push(
          `-- ${page.pageNumber} of ${screenshots.total} --\n${cleanedText}`,
        );
      }
    }

    return {
      text: pageTexts.join("\n\n"),
      pageCount: screenshots.total,
    };
  } finally {
    await worker.terminate();
    await parser.destroy();
  }
}
