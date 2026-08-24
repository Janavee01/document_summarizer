"use client";

import { useState } from "react";
import { AlertCircle, FileCode2, FileDown, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Summary } from "@/types/summary";
import {
  buildExportFileName,
  buildMarkdownExport,
  buildPlainTextExport,
  downloadTextFile,
  type ExportMeta,
} from "@/lib/summary-export";
import { exportSummaryPdf } from "@/lib/summary-pdf";

interface ExportButtonsProps {
  summary: Summary;
  meta?: ExportMeta;
  className?: string;
}

const EXPORT_OPTIONS = [
  { format: "txt" as const, label: "TXT", icon: FileText, mimeType: "text/plain" },
  {
    format: "md" as const,
    label: "MD",
    icon: FileCode2,
    mimeType: "text/markdown",
  },
];

export function ExportButtons({ summary, meta, className }: ExportButtonsProps) {
  const [failedFormat, setFailedFormat] = useState<string | null>(null);

  const handleDownloadText = (format: "txt" | "md") => {
    const option = EXPORT_OPTIONS.find((item) => item.format === format);
    if (!option) return;

    try {
      const content =
        format === "md"
          ? buildMarkdownExport(summary, meta)
          : buildPlainTextExport(summary, meta);

      downloadTextFile(
        buildExportFileName(summary, format),
        content,
        option.mimeType
      );
      setFailedFormat(null);
    } catch {
      setFailedFormat(option.label);
    }
  };

  const handleDownloadPdf = () => {
    try {
      exportSummaryPdf(summary, meta);
      setFailedFormat(null);
    } catch {
      setFailedFormat("PDF");
    }
  };

  const buttonClassName =
    "flex items-center gap-1.5 rounded-lg border border-line bg-paper-raised px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-teal/40 hover:text-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2";

  return (
    <div className={cn("flex flex-col items-start gap-1.5", className)}>
      <div
        role="group"
        aria-label="Export summary"
        className="flex flex-wrap items-center gap-2"
      >
        <span className="flex items-center gap-1 font-mono text-xs font-medium uppercase tracking-wide text-ink-faint">
          <FileDown aria-hidden="true" className="h-3.5 w-3.5" />
          Export
        </span>

        {EXPORT_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.format}
              type="button"
              onClick={() => handleDownloadText(option.format)}
              aria-label={`Export as ${option.label}`}
              className={buttonClassName}
            >
              <Icon aria-hidden="true" className="h-3.5 w-3.5" />
              {option.label}
            </button>
          );
        })}

        <button
          type="button"
          onClick={handleDownloadPdf}
          aria-label="Export as PDF"
          className={buttonClassName}
        >
          <FileDown aria-hidden="true" className="h-3.5 w-3.5" />
          PDF
        </button>
      </div>

      {failedFormat && (
        <p role="alert" className="flex items-center gap-1 text-xs text-danger">
          <AlertCircle aria-hidden="true" className="h-3 w-3 shrink-0" />
          Could not export {failedFormat}. Please try again.
        </p>
      )}
    </div>
  );
}
