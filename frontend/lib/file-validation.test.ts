import { describe, expect, it } from "vitest";

import {
  formatFileSize,
  getFileTypeLabel,
  isImageFile,
  MAX_FILE_SIZE,
  validateFile,
} from "./file-validation";

function makeFile(
  name: string,
  type: string,
  size = 1024,
): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe("validateFile", () => {
  it("rejects null/undefined files", () => {
    expect(validateFile(null).valid).toBe(false);
    expect(validateFile(undefined).valid).toBe(false);

    const result = validateFile(null);

    expect(result.valid === false && result.error).toBeTruthy();
  });

  it("accepts a valid PDF", () => {
    expect(validateFile(makeFile("doc.pdf", "application/pdf")).valid).toBe(
      true,
    );
  });

  it("accepts a valid PNG and JPEG (both extensions)", () => {
    expect(validateFile(makeFile("pic.png", "image/png")).valid).toBe(true);
    expect(validateFile(makeFile("pic.jpg", "image/jpeg")).valid).toBe(true);
    expect(validateFile(makeFile("pic.jpeg", "image/jpeg")).valid).toBe(true);
  });

  it("rejects files above the size limit", () => {
    const tooBig = makeFile("big.pdf", "application/pdf", MAX_FILE_SIZE + 1);
    const result = validateFile(tooBig);

    expect(result.valid).toBe(false);
    expect(result.valid === false && result.error).toMatch(/too large/i);
  });

  it("accepts files exactly at the size limit", () => {
    const atLimit = makeFile("edge.pdf", "application/pdf", MAX_FILE_SIZE);

    expect(validateFile(atLimit).valid).toBe(true);
  });

  it("rejects unsupported extensions", () => {
    for (const name of ["virus.exe", "no-extension", "doc.docx"]) {
      const file = makeFile(name, "application/pdf");
      const result = validateFile(file);

      expect(result.valid).toBe(false);
      expect(result.valid === false && result.error).toMatch(
        /unsupported file type/i,
      );
    }
  });

  it("rejects disallowed MIME types even with an allowed extension", () => {
    const file = makeFile("evil.pdf", "text/html");
    const result = validateFile(file);

    expect(result.valid).toBe(false);
    expect(result.valid === false && result.error).toMatch(
      /unsupported file type/i,
    );
  });

  it("allows empty MIME types as extension fallback", () => {
    expect(validateFile(makeFile("doc.pdf", "")).valid).toBe(true);
    expect(validateFile(makeFile("pic.png", "")).valid).toBe(true);
  });

  it("allows generic octet-stream MIME types", () => {
    expect(
      validateFile(makeFile("doc.pdf", "application/octet-stream")).valid,
    ).toBe(true);
  });

  it("rejects mismatched extension/MIME combinations", () => {
    const pdfWithPngMime = makeFile("doc.pdf", "image/png");
    const pngWithPdfMime = makeFile("pic.png", "application/pdf");
    const jpgWithPngMime = makeFile("photo.jpg", "image/png");

    for (const file of [pdfWithPngMime, pngWithPdfMime, jpgWithPngMime]) {
      const result = validateFile(file);

      expect(result.valid).toBe(false);
      expect(result.valid === false && result.error).toMatch(/do not match/i);
    }
  });
});

describe("formatFileSize", () => {
  it("formats bytes below 1 KB", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1023)).toBe("1023 B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatFileSize(MAX_FILE_SIZE)).toBe("10.0 MB");
  });
});

describe("getFileTypeLabel / isImageFile", () => {
  it("labels by extension case-insensitively", () => {
    expect(getFileTypeLabel(makeFile("a.PDF", ""))).toBe("PDF");
    expect(getFileTypeLabel(makeFile("b.Png", ""))).toBe("PNG");
    expect(getFileTypeLabel(makeFile("c.JPG", ""))).toBe("JPG");
    expect(getFileTypeLabel(makeFile("d.jpeg", ""))).toBe("JPG");
  });

  it("treats PDF as not-an-image and images as images", () => {
    expect(isImageFile(makeFile("a.pdf", ""))).toBe(false);
    expect(isImageFile(makeFile("b.png", ""))).toBe(true);
    expect(isImageFile(makeFile("c.jpg", ""))).toBe(true);
    expect(isImageFile(makeFile("d.jpeg", ""))).toBe(true);
  });
});
