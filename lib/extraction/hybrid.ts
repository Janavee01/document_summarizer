import { PDFParse } from "pdf-parse";
import { createWorker } from "tesseract.js";
import { extractPdfPageTexts } from "./pdf-pages";

export type HybridPageResult = {
  pageNumber: number;
  text: string;
  method: "pdf" | "ocr";
};

export type HybridExtractionResult = {
  text: string;
  pageCount: number;
  pages: HybridPageResult[];
};

function hasMeaningfulPageText(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return false;
  }

  if (normalized.length < 50) {
    return false;
  }

  const words = normalized.split(/\s+/).filter(Boolean);

  return words.length >= 10;
}

export async function extractHybridPdfText(
  buffer: Buffer,
): Promise<HybridExtractionResult> {
  const pageTextResult = await extractPdfPageTexts(buffer);

  const pagesNeedingOcr = pageTextResult.pages
    .filter((page) => !hasMeaningfulPageText(page.text))
    .map((page) => page.pageNumber);

  if (pagesNeedingOcr.length === 0) {
    return {
      text: pageTextResult.pages
        .map(
          (page) =>
            `-- ${page.pageNumber} of ${pageTextResult.pageCount} --\n${page.text}`,
        )
        .join("\n\n"),
      pageCount: pageTextResult.pageCount,
      pages: pageTextResult.pages.map((page) => ({
        pageNumber: page.pageNumber,
        text: page.text,
        method: "pdf",
      })),
    };
  }

  const parser = new PDFParse({
    data: buffer,
  });

  const worker = await createWorker("eng");

  try {
    const screenshots = await parser.getScreenshot({
      partial: pagesNeedingOcr,
      imageBuffer: true,
      imageDataUrl: false,
      scale: 1.5,
    });

    const ocrByPage = new Map<number, string>();

    for (const page of screenshots.pages) {
      const {
        data: { text },
      } = await worker.recognize(Buffer.from(page.data));

      ocrByPage.set(page.pageNumber, (text ?? "").trim());
    }

    const pages: HybridPageResult[] = pageTextResult.pages.map((page) => {
      if (hasMeaningfulPageText(page.text)) {
        return {
          pageNumber: page.pageNumber,
          text: page.text,
          method: "pdf",
        };
      }

      return {
        pageNumber: page.pageNumber,
        text: ocrByPage.get(page.pageNumber) ?? "",
        method: "ocr",
      };
    });

    const text = pages
      .filter((page) => page.text)
      .map(
        (page) =>
          `-- ${page.pageNumber} of ${pageTextResult.pageCount} --\n${page.text}`,
      )
      .join("\n\n");

    return {
      text,
      pageCount: pageTextResult.pageCount,
      pages,
    };
  } finally {
    await worker.terminate();
    await parser.destroy();
  }
}