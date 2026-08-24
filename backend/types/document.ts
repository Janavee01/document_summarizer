export type ExtractionMethod = "pdf-text" | "ocr";

export interface DocumentPage {
  pageNumber: number;
  text: string;
  wordCount: number;
  extractionMethod: ExtractionMethod;
}

export interface DocumentMetadata {
  fileName: string;
  fileType: "pdf" | "image";
  fileSizeBytes: number;
  pageCount: number;
}

export interface DocumentStatistics {
  totalWordCount: number;
  averageWordsPerPage: number;
}

export interface ExtractedDocument {
  metadata: DocumentMetadata;
  pages: DocumentPage[];
  statistics: DocumentStatistics;
}

export type UploadStatus = "idle" | "uploading" | "error";

export interface UploadedFile {
  file: File;
  status: UploadStatus;
  errorMessage?: string;
}
