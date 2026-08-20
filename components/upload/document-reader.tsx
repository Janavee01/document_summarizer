import { FileText, ScanText } from "lucide-react";
import type { ExtractionResult } from "@/lib/extraction";

interface DocumentReaderProps {
  result: ExtractionResult;
}

export function DocumentReader({ result }: DocumentReaderProps) {
  const methodLabel = result.method === "pdf" ? "PDF extraction" : "OCR extraction";
  const Icon = result.method === "pdf" ? FileText : ScanText;

  const statLine = [
    result.pageCount !== undefined
      ? `${result.pageCount} ${result.pageCount === 1 ? "page" : "pages"}`
      : null,
    `${result.wordCount.toLocaleString()} words`,
    `${result.characterCount.toLocaleString()} characters`,
    methodLabel,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="flex items-center gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-zinc-700 ring-1 ring-zinc-200">
          <Icon aria-hidden="true" className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-900">Document extracted</p>
          <p className="truncate text-xs text-zinc-500">{statLine}</p>
        </div>
      </div>

      <div className="max-h-[26rem] overflow-y-auto overflow-x-hidden px-4 py-4 sm:max-h-[32rem]">
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-800">
          {result.text}
        </p>
      </div>
    </div>
  );
}
