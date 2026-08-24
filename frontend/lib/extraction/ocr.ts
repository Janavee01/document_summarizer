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

/*
 * Each worker owns a separate WASM instance, so the pool size is
 * deliberately small: enough for meaningful speedup on multi-page
 * documents without multiplying memory usage.
 */
const MAX_OCR_WORKERS = 4;

/**
 * Creates a pool of Tesseract workers for parallel page recognition.
 *
 * Requesting more workers than MAX_OCR_WORKERS is clamped; requesting
 * fewer yields exactly that many (minimum one).
 */
export async function createOcrWorkerPool(
  requestedSize: number,
): Promise<Worker[]> {
  const size = Math.max(1, Math.min(requestedSize, MAX_OCR_WORKERS));

  const workers: Worker[] = [];

  try {
    for (let i = 0; i < size; i++) {
      workers.push(await createOcrWorker());
    }
  } catch (error) {
    await Promise.allSettled(
      workers.map((worker) => worker.terminate()),
    );
    throw error;
  }

  return workers;
}

/**
 * Terminates every worker in a pool, ignoring individual failures so
 * one stuck worker cannot prevent the others from being cleaned up.
 */
export async function terminateOcrWorkers(workers: Worker[]): Promise<void> {
  await Promise.allSettled(
    workers.map((worker) => worker.terminate()),
  );
}