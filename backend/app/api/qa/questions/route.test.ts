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
  generateSuggestedQuestions,
} from "@/lib/qa";

import { POST } from "./route";

const mockedGenerate = vi.mocked(generateSuggestedQuestions);

const DOCUMENT_TEXT =
  "A sufficiently long document body used to satisfy the minimum " +
  "length requirement of the questions endpoint.";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/qa/questions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/qa/questions", () => {
  beforeEach(() => {
    mockedGenerate.mockReset();
  });

  it("returns 400 for a non-JSON body", async () => {
    const request = new Request("http://localhost/api/qa/questions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{{{",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_INPUT");
  });

  it("returns 400 when text is missing or blank", async () => {
    for (const body of [{}, { text: "" }, { text: " \n " }]) {
      const response = await POST(jsonRequest(body));

      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("INVALID_INPUT");
    }

    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it("returns suggested questions on success", async () => {
    mockedGenerate.mockResolvedValue(["What is X?", "Who wrote it?"]);

    const response = await POST(
      jsonRequest({ text: DOCUMENT_TEXT }),
    );

    expect(response.status).toBe(200);

    const payload = await response.json();

    expect(payload.success).toBe(true);
    expect(payload.data.questions).toEqual([
      "What is X?",
      "Who wrote it?",
    ]);
  });

  it("maps QaConfigError to a 500 CONFIG_ERROR", async () => {
    mockedGenerate.mockRejectedValue(new QaConfigError("Missing key"));

    const response = await POST(jsonRequest({ text: DOCUMENT_TEXT }));

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("CONFIG_ERROR");
  });

  it("maps QaRequestError to a 502 QA_FAILED", async () => {
    mockedGenerate.mockRejectedValue(new QaRequestError("Too short"));

    const response = await POST(jsonRequest({ text: DOCUMENT_TEXT }));

    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe("QA_FAILED");
  });

  it("hides unexpected errors behind a generic 500", async () => {
    mockedGenerate.mockRejectedValue(new Error("internal prompt leak"));

    const response = await POST(jsonRequest({ text: DOCUMENT_TEXT }));

    expect(response.status).toBe(500);

    const payload = await response.json();

    expect(payload.error.code).toBe("QA_FAILED");
    expect(payload.error.message).not.toContain("internal prompt leak");
  });
});
