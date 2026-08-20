import { createWorker, type Worker } from "tesseract.js";

export interface OcrExtractionResult {
  text: string;
}

async function createOcrWorker(): Promise<Worker> {
  return createWorker("eng");
}

/**
 * Runs OCR on an image buffer.
 *
 * A worker is created for the individual image and terminated after
 * extraction. For multi-page documents, use createOcrWorker() and
 * recognizeWithWorker() so the same worker can process multiple pages.
 */
export async function extractImageText(
  buffer: Buffer,
): Promise<OcrExtractionResult> {
  const worker = await createOcrWorker();

  try {
    return await recognizeWithWorker(worker, buffer);
  } finally {
    await worker.terminate();
  }
}

/**
 * Runs OCR using an existing Tesseract worker.
 *
 * Reusing a worker is significantly more efficient when processing
 * multiple pages from the same document.
 */
export async function recognizeWithWorker(
  worker: Worker,
  buffer: Buffer,
): Promise<OcrExtractionResult> {
  try {
    const {
      data: { text },
    } = await worker.recognize(buffer);

    return {
      text: (text ?? "").trim(),
    };
  } catch {
    throw new Error(
      "Failed to run OCR on the image. The file may be corrupted or in an unsupported format.",
    );
  }
}

/**
 * Creates a reusable Tesseract worker for multi-page OCR.
 */
export { createOcrWorker };