import { NextResponse } from "next/server";
import {
  generateSuggestedQuestions,
  QaConfigError,
  QaRequestError,
} from "@/lib/qa";

export const runtime = "nodejs";
export const maxDuration = 60;

type ErrorCode = "INVALID_INPUT" | "CONFIG_ERROR" | "QA_FAILED";

function errorResponse(code: ErrorCode, message: string, status: number) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status }
  );
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_INPUT", "Request body must be JSON.", 400);
  }

  const { text } = (body ?? {}) as { text?: unknown };

  if (typeof text !== "string" || !text.trim()) {
    return errorResponse(
      "INVALID_INPUT",
      "No document text was provided.",
      400
    );
  }

  try {
    const questions = await generateSuggestedQuestions(text);
    return NextResponse.json(
      { success: true, data: { questions } },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof QaConfigError) {
      return errorResponse("CONFIG_ERROR", err.message, 500);
    }

    if (err instanceof QaRequestError) {
      return errorResponse("QA_FAILED", err.message, 502);
    }

    console.error("Suggested question generation failed:", err);

    return errorResponse(
      "QA_FAILED",
      "Something went wrong while generating suggested questions. Please try again.",
      500
    );
  }
}
