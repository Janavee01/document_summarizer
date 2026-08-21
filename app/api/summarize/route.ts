import { NextResponse } from "next/server";
import {
  generateSummary,
  SummarizationConfigError,
  SummarizationRequestError,
} from "@/lib/summarization/index";
import type { SummaryLength } from "@/types/summary";

export const runtime = "nodejs";
// LLM calls, especially for longer documents, can take a while.
export const maxDuration = 60;

const VALID_LENGTHS: SummaryLength[] = ["short", "medium", "long"];

type ErrorCode = "INVALID_INPUT" | "CONFIG_ERROR" | "SUMMARIZATION_FAILED";

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

  const { text, length } = (body ?? {}) as {
    text?: unknown;
    length?: unknown;
  };

  if (typeof text !== "string" || !text.trim()) {
    return errorResponse(
      "INVALID_INPUT",
      "No document text was provided to summarize.",
      400
    );
  }

  const summaryLength: SummaryLength = VALID_LENGTHS.includes(
    length as SummaryLength
  )
    ? (length as SummaryLength)
    : "medium";

  try {
    console.log("========== API SUMMARIZE ==========");
console.log("Received text characters:", text.length);
console.log("===================================");
    const summary = await generateSummary(text, summaryLength);
    return NextResponse.json(
      { success: true, data: summary },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof SummarizationConfigError) {
      return errorResponse("CONFIG_ERROR", err.message, 500);
    }

    if (err instanceof SummarizationRequestError) {
      return errorResponse("SUMMARIZATION_FAILED", err.message, 502);
    }

    // Log the real error server-side only — the client never sees a stack
    // trace or internal error detail.
    console.error("Summary generation failed:", err);

    return errorResponse(
      "SUMMARIZATION_FAILED",
      "Something went wrong while generating the summary. Please try again.",
      500
    );
  }
}
