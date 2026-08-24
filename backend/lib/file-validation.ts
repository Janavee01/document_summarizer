export const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg"]);
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);

export type FileValidationResult =
  | { valid: true }
  | { valid: false; error: string };

function getExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot === -1 ? "" : fileName.slice(lastDot + 1).toLowerCase();
}

export function validateFile(file: File | null | undefined): FileValidationResult {
  if (!file) {
    return { valid: false, error: "Please select a file." };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: "File is too large. Please upload a file smaller than 10 MB.",
    };
  }

  const extension = getExtension(file.name);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return {
      valid: false,
      error: "Unsupported file type. Please upload a PDF, PNG, JPG, or JPEG file.",
    };
  }

  // Some browsers report an empty or generic MIME type. In that case the
  // extension is the fallback; when a specific MIME type is available, it
  // must agree with the selected file format.
  if (file.type && file.type !== "application/octet-stream" && !ALLOWED_MIME_TYPES.has(file.type)) {
    return {
      valid: false,
      error: "Unsupported file type. Please upload a PDF, PNG, JPG, or JPEG file.",
    };
  }

  const extensionMatchesMime =
    extension === "pdf"
      ? file.type === "application/pdf"
      : extension === "png"
        ? file.type === "image/png"
        : extension === "jpg" || extension === "jpeg"
          ? file.type === "image/jpeg"
          : false;

  if (
    file.type &&
    file.type !== "application/octet-stream" &&
    !extensionMatchesMime
  ) {
    return {
      valid: false,
      error: "The file extension and file type do not match. Please choose a valid PDF, PNG, JPG, or JPEG file.",
    };
  }

  return { valid: true };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileTypeLabel(file: File): "PDF" | "PNG" | "JPG" {
  const extension = getExtension(file.name);
  if (extension === "pdf") return "PDF";
  if (extension === "png") return "PNG";
  return "JPG";
}

export function isImageFile(file: File): boolean {
  return getFileTypeLabel(file) !== "PDF";
}
