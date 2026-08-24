import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/extraction", () => {
  class EmptyExtractionError extends Error {}

  return {
    extractDocumentText: vi.fn(),
    EmptyExtractionError,
  };
});

import {
  EmptyExtractionError,
  extractDocumentText,
} from "@/lib/extraction";
import { MAX_FILE_SIZE } from "@/lib/file-validation";

import { POST } from "./route";

const mockedExtract = vi.mocked(extractDocumentText);

function makePdfFile(name = "doc.pdf", size = 1024): File {
  return new File([new Uint8Array(size)], name, { type: "application/pdf" });
}

function formRequest(file: File | null): Request {
  const formData = new FormData();

  if (file) {
    formData.append("file", file);
  }

  return new Request("http://localhost/api/extract", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/extract", () => {
  beforeEach(() => {
    mockedExtract.mockReset();
  });

  it("returns 400 when the body is not multipart form data", async () => {
    const request = new Request("http://localhost/api/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ file: "sneaky" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_FILE");
  });

  it("returns 400 when no file field is present", async () => {
    const response = await POST(formRequest(null));

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("NO_FILE");
  });

  it("returns 400 for an unsupported extension", async () => {
    const response = await POST(
      formRequest(
        new File([new Uint8Array(10)], "notes.txt", { type: "text/plain" }),
      ),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_FILE");
    expect(mockedExtract).not.toHaveBeenCalled();
  });

  it("returns 413 for an oversized file", async () => {
    const response = await POST(
      formRequest(makePdfFile("big.pdf", MAX_FILE_SIZE + 1)),
    );

    expect(response.status).toBe(413);

    const payload = await response.json();

    expect(payload.error.code).toBe("FILE_TOO_LARGE");
    expect(mockedExtract).not.toHaveBeenCalled();
  });

  it("returns 200 with extraction data on success and detects PDF source", async () => {
    mockedExtract.mockResolvedValue({
      text: "extracted text",
      pageCount: 2,
      pages: [],
      wordCount: 2,
      characterCount: 14,
      method: "pdf",
    });

    const response = await POST(formRequest(makePdfFile()));

    expect(response.status).toBe(200);

    const payload = await response.json();

    expect(payload.success).toBe(true);
    expect(payload.data.text).toBe("extracted text");
    expect(mockedExtract).toHaveBeenCalledWith(expect.any(Buffer), "pdf");
  });

  it("detects image uploads as the OCR source type", async () => {
    mockedExtract.mockResolvedValue({
      text: "ocr text",
      pages: [],
      wordCount: 2,
      characterCount: 8,
      method: "ocr",
    });

    await POST(
      formRequest(
        new File([new Uint8Array(10)], "pic.png", { type: "image/png" }),
      ),
    );

    expect(mockedExtract).toHaveBeenCalledWith(expect.any(Buffer), "image");
  });

  it("maps EmptyExtractionError to a 422 EMPTY_EXTRACTION", async () => {
    // Imported through the mocked module path, so instanceof in the route
    // recognizes it.
    mockedExtract.mockRejectedValue(
      new EmptyExtractionError("No readable text found"),
    );

    const response = await POST(formRequest(makePdfFile()));

    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("EMPTY_EXTRACTION");
  });

  it("maps unexpected errors to a generic 500 EXTRACTION_FAILED", async () => {
    mockedExtract.mockRejectedValue(new Error("corrupt pdf internals"));

    const response = await POST(formRequest(makePdfFile()));

    expect(response.status).toBe(500);

    const payload = await response.json();

    expect(payload.error.code).toBe("EXTRACTION_FAILED");
    expect(payload.error.message).not.toContain("corrupt pdf internals");
  });
});
