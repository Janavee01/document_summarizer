"use client";

import { useRef, useState } from "react";
import {
  FileText,
  Image as ImageIcon,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import {
  formatFileSize,
  getFileTypeLabel,
  isImageFile,
  validateFile,
} from "@/lib/file-validation";
import { SummaryPanel } from "@/components/summary/summary-panel";

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const imagePreviewUrlRef = useRef<string | null>(null);
  // Changes on every selection so the summary panel fully remounts and never
  // carries extracted text over from a previously selected document.
  const [selectionCount, setSelectionCount] = useState(0);

  const openFilePicker = () => inputRef.current?.click();

  const selectFile = (file: File | null) => {
    const result = validateFile(file);

    if (imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current);
      imagePreviewUrlRef.current = null;
    }

    setSelectionCount((count) => count + 1);

    if (!result.valid) {
      setImagePreviewUrl(null);
      setSelectedFile(null);
      setError(result.error);
      return;
    }

    if (file && isImageFile(file)) {
      const url = URL.createObjectURL(file);
      imagePreviewUrlRef.current = url;
      setImagePreviewUrl(url);
    } else {
      setImagePreviewUrl(null);
    }

    setSelectedFile(file);
    setError(null);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    selectFile(event.target.files?.[0] ?? null);
    event.target.value = "";
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openFilePicker();
    }
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragActive(true);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setIsDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current -= 1;

    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setIsDragActive(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragActive(false);
    selectFile(event.dataTransfer.files?.[0] ?? null);
  };

  const removeFile = () => {
    if (imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current);
      imagePreviewUrlRef.current = null;
    }

    setImagePreviewUrl(null);
    setSelectedFile(null);
    setError(null);
    setIsDragActive(false);
    dragDepthRef.current = 0;
  };

  return (
    <main className="flex min-h-screen items-start justify-center bg-zinc-50 px-4 py-10 font-sans text-zinc-950">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
        onChange={handleInputChange}
        className="sr-only"
      />
      <section className="w-full max-w-2xl">
        <div className="mb-7 text-center">
          <p className="mb-2 text-sm font-medium text-zinc-500">
            Document Summarizer
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Upload a document
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Upload a PDF or image and get an instant summary.
          </p>
        </div>

        {selectedFile ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {imagePreviewUrl ? (
                <img
                  src={imagePreviewUrl}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-lg border border-zinc-200 object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-white text-zinc-700 ring-1 ring-zinc-200">
                  <FileText aria-hidden="true" className="h-7 w-7" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900">
                  {selectedFile.name}
                </p>
                <p className="mt-1 truncate text-sm text-zinc-500">
                  {getFileTypeLabel(selectedFile)} ·{" "}
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={openFilePicker}
                  className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 sm:flex-none"
                >
                  Choose another file
                </button>
                <button
                  type="button"
                  onClick={removeFile}
                  aria-label="Remove selected file"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
                >
                  <X aria-hidden="true" className="h-5 w-5" />
                </button>
              </div>
            </div>

            <SummaryPanel key={selectionCount} file={selectedFile} />
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            aria-label="Choose a document to upload"
            onClick={openFilePicker}
            onKeyDown={handleKeyDown}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center outline-none transition-colors sm:p-12 ${
              isDragActive
                ? "border-zinc-900 bg-zinc-100"
                : error
                  ? "border-red-300 bg-red-50/40 hover:border-red-400"
                  : "border-zinc-300 bg-white hover:border-zinc-400 hover:bg-zinc-50"
            } focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2`}
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-zinc-700 shadow-sm ring-1 ring-zinc-200">
              {isDragActive ? (
                <Upload aria-hidden="true" className="h-6 w-6" />
              ) : (
                <ImageIcon aria-hidden="true" className="h-6 w-6" />
              )}
            </div>
            <p className="mt-4 text-sm font-medium text-zinc-900">
              {isDragActive
                ? "Drop your file here"
                : "Drop a file here or click to browse"}
            </p>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-zinc-500">
              <Sparkles aria-hidden="true" className="h-3 w-3" />
              PDF, PNG, JPG, or JPEG · Max 10 MB · Summaries are saved to your
              history
            </p>
          </div>
        )}

        {error && !selectedFile && (
          <p role="alert" className="mt-3 text-center text-sm font-medium text-red-600">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
