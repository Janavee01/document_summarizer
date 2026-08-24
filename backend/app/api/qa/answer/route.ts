import { NextResponse } from "next/server";
import {
  answerQuestion,
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

  const { text, question } = (body ?? {}) as {
    text?: unknown;
    question?: unknown;
  };

  if (typeof text !== "string" || !text.trim()) {
    return errorResponse(
      "INVALID_INPUT",
      "No document text was provided.",
      400
    );
  }

  if (typeof question !== "string" || !question.trim()) {
    return errorResponse("INVALID_INPUT", "No question was provided.", 400);
  }

  try {
    const result = await answerQuestion(text, question);
    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (err) {
    if (err instanceof QaConfigError) {
      return errorResponse("CONFIG_ERROR", err.message, 500);
    }

    if (err instanceof QaRequestError) {
      return errorResponse("QA_FAILED", err.message, 502);
    }

    console.error("Question answering failed:", err);

    return errorResponse(
      "QA_FAILED",
      "Something went wrong while answering the question. Please try again.",
      500
    );
  }
}
