import { NextResponse } from "next/server";
import { validateFile, isImageFile } from "@/lib/file-validation";
import { extractDocumentText, EmptyExtractionError } from "@/lib/extraction";

// pdf-parse and tesseract.js need the Node runtime (fs, wasm bindings) —
// this route cannot run on the Edge runtime.
export const runtime = "nodejs";
// OCR can take a while on larger images; give it more headroom than the
// platform default.
export const maxDuration = 60;

type ErrorCode =
  | "NO_FILE"
  | "INVALID_FILE"
  | "FILE_TOO_LARGE"
  | "EMPTY_EXTRACTION"
  | "EXTRACTION_FAILED";

function errorResponse(code: ErrorCode, message: string, status: number) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status }
  );
}

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return errorResponse(
      "INVALID_FILE",
      "Could not read the uploaded file.",
      400
    );
  }

  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return errorResponse("NO_FILE", "No file was provided.", 400);
  }

  // Never trust the client — re-run the same validation (extension + MIME
  // + size) the frontend uses before touching the file contents.
  const validation = validateFile(file);
  if (!validation.valid) {
    const isSizeError = validation.error.toLowerCase().includes("too large");
    return errorResponse(
      isSizeError ? "FILE_TOO_LARGE" : "INVALID_FILE",
      validation.error,
      isSizeError ? 413 : 400
    );
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return errorResponse(
      "INVALID_FILE",
      "Could not read the uploaded file.",
      400
    );
  }

  const sourceType = isImageFile(file) ? "image" : "pdf";

  try {
    const result = await extractDocumentText(buffer, sourceType);
    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (err) {
    if (err instanceof EmptyExtractionError) {
      return errorResponse("EMPTY_EXTRACTION", err.message, 422);
    }

    // Log the real error server-side only — the client never sees a stack
    // trace or internal error detail.
    console.error("Text extraction failed:", err);

    return errorResponse(
      "EXTRACTION_FAILED",
      sourceType === "pdf"
        ? "We couldn't extract text from this PDF. It may be corrupted or use an unsupported format."
        : "We couldn't run OCR on this image. It may be corrupted or use an unsupported format.",
      500
    );
  }
}
