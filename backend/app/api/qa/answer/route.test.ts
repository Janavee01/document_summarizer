import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/qa", () => {
  class QaConfigError extends Error {}
  class QaRequestError extends Error {}

  return {
    generateSuggestedQuestions: vi.fn(),
    answerQuestion: vi.fn(),
    QaConfigError,
    QaRequestError,
  };
});

import {
  QaConfigError,
  QaRequestError,
  answerQuestion,
} from "@/lib/qa";

import { POST } from "./route";

const mockedAnswer = vi.mocked(answerQuestion);

const DOCUMENT_TEXT =
  "A sufficiently long document body used to satisfy the minimum " +
  "length requirement of the answer endpoint.";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/qa/answer", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/qa/answer", () => {
  beforeEach(() => {
    mockedAnswer.mockReset();
  });

  it("returns 400 for a non-JSON body", async () => {
    const request = new Request("http://localhost/api/qa/answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json at all",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_INPUT");
  });

  it("returns 400 when text is missing or blank", async () => {
    for (const body of [
      {},
      { text: "", question: "What?" },
      { text: "   ", question: "What?" },
    ]) {
      const response = await POST(jsonRequest(body));

      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("INVALID_INPUT");
    }

    expect(mockedAnswer).not.toHaveBeenCalled();
  });

  it("returns 400 when question is missing or blank", async () => {
    for (const question of [undefined, "", "   ", 7]) {
      const response = await POST(
        jsonRequest({ text: DOCUMENT_TEXT, question }),
      );

      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("INVALID_INPUT");
    }

    expect(mockedAnswer).not.toHaveBeenCalled();
  });

  it("returns the answer on success and forwards arguments", async () => {
    mockedAnswer.mockResolvedValue({
      answer: "Because of reasons.",
      sourcesUsed: 1,
    });

    const response = await POST(
      jsonRequest({ text: DOCUMENT_TEXT, question: "Why?" }),
    );

    expect(response.status).toBe(200);
    expect(mockedAnswer).toHaveBeenCalledWith(DOCUMENT_TEXT, "Why?");

    const payload = await response.json();

    expect(payload.success).toBe(true);
    expect(payload.data.answer).toBe("Because of reasons.");
  });

  it("maps QaConfigError to a 500 CONFIG_ERROR", async () => {
    mockedAnswer.mockRejectedValue(new QaConfigError("Missing key"));

    const response = await POST(
      jsonRequest({ text: DOCUMENT_TEXT, question: "Why?" }),
    );

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("CONFIG_ERROR");
  });

  it("maps QaRequestError to a 502 QA_FAILED", async () => {
    mockedAnswer.mockRejectedValue(new QaRequestError("Model failed"));

    const response = await POST(
      jsonRequest({ text: DOCUMENT_TEXT, question: "Why?" }),
    );

    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe("QA_FAILED");
  });

  it("hides unexpected errors behind a generic 500", async () => {
    mockedAnswer.mockRejectedValue(new Error("retrieval internals"));

    const response = await POST(
      jsonRequest({ text: DOCUMENT_TEXT, question: "Why?" }),
    );

    expect(response.status).toBe(500);

    const payload = await response.json();

    expect(payload.error.code).toBe("QA_FAILED");
    expect(payload.error.message).not.toContain("retrieval internals");
  });
});
