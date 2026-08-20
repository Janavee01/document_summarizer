import { createWorker } from "tesseract.js";

export interface OcrExtractionResult {
  text: string;
}

/**
 * Runs OCR on an image buffer using Tesseract.js (pure JS/WASM — no
 * system-level Tesseract binary required, so this works in any Node
 * deployment target).
 */
export async function extractImageText(
  buffer: Buffer
): Promise<OcrExtractionResult> {
  const worker = await createWorker("eng");

  try {
    const {
      data: { text },
    } = await worker.recognize(buffer);

    return { text: (text ?? "").trim() };
  } catch {
    throw new Error(
      "Failed to run OCR on the image. The file may be corrupted or in an unsupported format."
    );
  } finally {
    // Always release the worker, even on failure, so we don't leak workers
    // across requests.
    await worker.terminate();
  }
}
