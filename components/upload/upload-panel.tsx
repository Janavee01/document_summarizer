"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = ".pdf,.png,.jpg,.jpeg";
const SUPPORTED_LABELS = ["PDF", "PNG", "JPG", "JPEG"];

export function UploadPanel() {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // File handling is implemented in V1.
  }, []);

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
        aria-label="Upload a document"
        className={cn(
          "group relative flex flex-col items-center justify-center gap-4 border border-dashed px-8 py-16 text-center transition-colors cursor-pointer",
          isDragging ? "border-accent bg-accent-soft" : "border-border hover:border-ink/30"
        )}
      >
        <span className="pointer-events-none absolute left-3 top-3 h-4 w-4 border-l border-t border-ink/25" />
        <span className="pointer-events-none absolute right-3 top-3 h-4 w-4 border-r border-t border-ink/25" />
        <span className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 border-b border-l border-ink/25" />
        <span className="pointer-events-none absolute bottom-3 right-3 h-4 w-4 border-b border-r border-ink/25" />

        <UploadCloud className="h-7 w-7 text-muted transition-colors group-hover:text-accent" strokeWidth={1.5} />
        <div className="space-y-1">
          <p className="text-sm font-medium text-ink">Drop a file here, or click to browse</p>
          <p className="text-xs text-muted">One document at a time · up to 25MB</p>
        </div>

        <input ref={inputRef} type="file" accept={ACCEPTED_TYPES} className="hidden" aria-hidden="true" />
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 font-mono text-[11px] tracking-wide text-muted">
        {SUPPORTED_LABELS.map((label, i) => (
          <span key={label} className="flex items-center gap-2">
            <span className="border border-border px-1.5 py-0.5">{label}</span>
            {i < SUPPORTED_LABELS.length - 1 && <span className="text-border">/</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
