"use client";

import { useRef, useState } from "react";
import {
  FileText,
  Image as ImageIcon,
  ScanText,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatFileSize,
  getFileTypeLabel,
  isImageFile,
  validateFile,
} from "@/lib/file-validation";
import { SummaryPanel } from "@/components/summary/summary-panel";

const FEATURES = [
  { icon: FileText, label: "PDF & images" },
  { icon: Sparkles, label: "AI key points" },
  { icon: ScanText, label: "Ask questions" },
];

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
    <main className="flex min-h-screen items-start justify-center px-4 py-10 sm:py-16">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
        onChange={handleInputChange}
        className="sr-only"
      />
      <section className="w-full max-w-2xl">
        {!selectedFile && (
          <header className="mb-9 text-center">
            <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
              Turn any document into a
              <br className="hidden sm:block" /> clear summary
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink-soft sm:text-base">
              Drop in a PDF or an image and get the key points, main ideas,
              and action items in seconds — then ask questions about the
              document.
            </p>
          </header>
        )}

        {selectedFile ? (
          <div className="card-index p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {imagePreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- ephemeral blob: preview; next/image cannot optimize these
                <img
                  src={imagePreviewUrl}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-lg border border-line object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-teal-soft text-teal">
                  <FileText aria-hidden="true" className="h-7 w-7" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {selectedFile.name}
                </p>
                <p className="mt-1 truncate font-mono text-xs uppercase tracking-wide text-ink-faint">
                  {getFileTypeLabel(selectedFile)} ·{" "}
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={openFilePicker}
                  className="rounded-lg border border-line bg-paper-raised px-3 py-2 text-xs font-medium text-ink transition-colors hover:border-ink/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
                >
                  Replace file
                </button>
                <button
                  type="button"
                  onClick={removeFile}
                  aria-label="Remove selected file"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent text-ink-faint transition-colors hover:border-line hover:bg-paper hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
                >
                  <X aria-hidden="true" className="h-5 w-5" />
                </button>
              </div>
            </div>

            <SummaryPanel key={selectionCount} file={selectedFile} />
          </div>
        ) : (
          <>
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
              className={cn(
                "card-index cursor-pointer border-2 border-dashed px-8 py-12 text-center outline-none transition-all duration-200 sm:px-12",
                isDragActive
                  ? "-translate-y-0.5 border-teal bg-teal-soft shadow-md"
                  : error
                    ? "border-danger/50 bg-danger-soft/40 hover:border-danger"
                    : "border-line hover:-translate-y-0.5 hover:border-teal/60 hover:shadow-md"
              )}
            >
              <div
                className={cn(
                  "mx-auto flex h-14 w-14 items-center justify-center rounded-full transition-colors",
                  isDragActive
                    ? "bg-teal text-white"
                    : "bg-teal-soft text-teal"
                )}
              >
                {isDragActive ? (
                  <Upload aria-hidden="true" className="h-7 w-7" />
                ) : (
                  <ImageIcon aria-hidden="true" className="h-7 w-7" />
                )}
              </div>

              <p className="mt-5 text-base font-semibold text-ink">
                {isDragActive
                  ? "Drop your file to begin"
                  : "Drop a file here, or click to browse"}
              </p>
              <p className="mt-1.5 font-mono text-xs uppercase tracking-wide text-ink-faint">
                PDF · PNG · JPG · up to 10 MB
              </p>
            </div>

            <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {FEATURES.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="flex items-center gap-1.5 text-xs font-medium text-ink-soft"
                >
                  <Icon aria-hidden="true" className="h-3.5 w-3.5 text-teal" />
                  {label}
                </li>
              ))}
            </ul>
          </>
        )}

        {error && !selectedFile && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-2.5 text-center text-sm font-medium text-danger"
          >
            {error}
          </p>
        )}

        <p className="mt-8 text-center text-xs text-ink-faint">
          Summaries are saved privately to this device.
        </p>
      </section>
    </main>
  );
}
