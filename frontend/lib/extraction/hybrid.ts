import { PDFParse } from "pdf-parse";
import {
  createOcrWorkerPool,
  terminateOcrWorkers,
} from "./ocr";
import { normalizeExtractedText } from "./text-normalization";
import { extractPdfPageTexts } from "./pdf-pages";
import { analyzeTextQuality } from "./text-quality";

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

function formatPageText(
  pageNumber: number,
  pageCount: number,
  text: string,
): string {
  const trimmedText = text.trim();

  if (!trimmedText) {
    return "";
  }

  return `-- ${pageNumber} of ${pageCount} --\n${trimmedText}`;
}

function combinePages(
  pages: HybridPageResult[],
  pageCount: number,
): string {
  return pages
    .map((page) =>
      formatPageText(
        page.pageNumber,
        pageCount,
        page.text,
      ),
    )
    .filter(Boolean)
    .join("\n\n");
}

export async function extractHybridPdfText(
  buffer: Buffer,
): Promise<HybridExtractionResult> {
  const pageTextResult = await extractPdfPageTexts(buffer);

  /*
   * Analyze every page independently.
   *
   * Native PDF extraction is preferred when the extracted text
   * has sufficient evidence of being readable. OCR is restricted
   * to pages whose multi-signal quality score is suspicious.
   */
  const pageQualities = pageTextResult.pages.map((page) => ({
    page,
    quality: analyzeTextQuality(page.text),
  }));

  const pagesNeedingOcr = pageQualities
    .filter(({ quality }) => quality.isSuspicious)
    .map(({ page }) => page.pageNumber);

  /*
   * Fast path:
   * If all pages have trustworthy native text, avoid rendering
   * and OCR entirely.
   */
  if (pagesNeedingOcr.length === 0) {
    const pages: HybridPageResult[] =
      pageTextResult.pages.map((page) => ({
        pageNumber: page.pageNumber,
        text: page.text,
        method: "pdf",
      }));

    return {
      text: combinePages(
        pages,
        pageTextResult.pageCount,
      ),
      pageCount: pageTextResult.pageCount,
      pages,
    };
  }

  const parser = new PDFParse({
    data: buffer,
  });

  const ocrWorkers = await createOcrWorkerPool(pagesNeedingOcr.length);

  try {
    /*
     * Render only suspicious pages.
     */
    const screenshots = await parser.getScreenshot({
      partial: pagesNeedingOcr,
      imageBuffer: true,
      imageDataUrl: false,
      scale: 1.5,
    });

    const ocrByPage = new Map<number, string>();

    /*
     * Pages are distributed round-robin across the worker pool; each
     * worker processes its share sequentially, so recognitions run in
     * parallel across workers without contending for a single one.
     */
    await Promise.all(
      screenshots.pages.map((page, position) => {
        const worker = ocrWorkers[position % ocrWorkers.length];

        return worker
          .recognize(Buffer.from(page.data))
          .then(({ data }) => {
            ocrByPage.set(
              page.pageNumber,
              normalizeExtractedText(data.text ?? ""),
            );
          });
      }),
    );

    const pages: HybridPageResult[] =
      pageTextResult.pages.map((page) => {
        const quality = pageQualities.find(
          (entry) =>
            entry.page.pageNumber === page.pageNumber,
        );

        if (!quality?.quality.isSuspicious) {
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

    return {
      text: combinePages(
        pages,
        pageTextResult.pageCount,
      ),
      pageCount: pageTextResult.pageCount,
      pages,
    };
  } finally {
    await terminateOcrWorkers(ocrWorkers);
    await parser.destroy();
  }
}
