import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/summarization/index", () => {
  class SummarizationConfigError extends Error {}
  class SummarizationRequestError extends Error {}

  return {
    generateSummary: vi.fn(),
    SummarizationConfigError,
    SummarizationRequestError,
  };
});

import {
  generateSummary,
  SummarizationConfigError,
  SummarizationRequestError,
} from "@/lib/summarization/index";
import type { Summary } from "@/types/summary";

import { POST } from "./route";

const mockedGenerateSummary = vi.mocked(generateSummary);

function makeSummary(): Summary {
  return {
    title: "Test document",
    documentType: "Report",
    summary: "A summary.",
    keyPoints: ["point"],
    mainIdeas: ["idea"],
    entities: [],
    actionItems: [],
  };
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/summarize", {
    method: "POST",
    body:
      typeof body === "string"
        ? body
        : JSON.stringify(body),
    headers:
      typeof body === "string"
        ? { "content-type": "application/json" }
        : undefined,
  });
}

describe("POST /api/summarize", () => {
  beforeEach(() => {
    mockedGenerateSummary.mockReset();
  });

  it("returns 400 for a non-JSON body", async () => {
    const response = await POST(jsonRequest("not json"));

    expect(response.status).toBe(400);

    const payload = await response.json();

    expect(payload.error.code).toBe("INVALID_INPUT");
  });

  it("returns 400 when text is missing or blank", async () => {
    for (const body of [{}, { text: "" }, { text: "   " }, { text: 42 }]) {
      const response = await POST(jsonRequest(body));

      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("INVALID_INPUT");
    }

    expect(mockedGenerateSummary).not.toHaveBeenCalled();
  });

  it("passes a valid length through to generateSummary", async () => {
    mockedGenerateSummary.mockResolvedValue(makeSummary());

    const response = await POST(
      jsonRequest({ text: "hello world", length: "short" }),
    );

    expect(response.status).toBe(200);
    expect(mockedGenerateSummary).toHaveBeenCalledWith(
      "hello world",
      "short",
    );

    const payload = await response.json();

    expect(payload.success).toBe(true);
    expect(payload.data.title).toBe("Test document");
  });

  it("falls back to medium length for an unrecognized length", async () => {
    mockedGenerateSummary.mockResolvedValue(makeSummary());

    await POST(jsonRequest({ text: "hello world", length: "gigantic" }));

    expect(mockedGenerateSummary).toHaveBeenCalledWith(
      "hello world",
      "medium",
    );
  });

  it("maps SummarizationConfigError to a 500 CONFIG_ERROR", async () => {
    mockedGenerateSummary.mockRejectedValue(
      new SummarizationConfigError("Missing API key"),
    );

    const response = await POST(jsonRequest({ text: "hello world" }));

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("CONFIG_ERROR");
  });

  it("maps SummarizationRequestError to a 502 SUMMARIZATION_FAILED", async () => {
    mockedGenerateSummary.mockRejectedValue(
      new SummarizationRequestError("Model returned garbage"),
    );

    const response = await POST(jsonRequest({ text: "hello world" }));

    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe("SUMMARIZATION_FAILED");
  });

  it("hides unexpected errors behind a generic 500", async () => {
    mockedGenerateSummary.mockRejectedValue(
      new Error("secret stack detail"),
    );

    const response = await POST(jsonRequest({ text: "hello world" }));

    expect(response.status).toBe(500);

    const payload = await response.json();

    expect(payload.error.code).toBe("SUMMARIZATION_FAILED");
    expect(payload.error.message).not.toContain("secret stack detail");
  });
});
