"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  Link2,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buildShareLink, copyTextToClipboard } from "@/lib/share";
import type { Summary, SummaryLength } from "@/types/summary";
import {
  createHistoryEntryFromSummary,
  saveHistoryEntry,
} from "@/lib/history";
import { SummaryView } from "@/components/summary/summary-view";
import { DocumentQa } from "@/components/summary/document-qa";
import { ExportButtons } from "@/components/summary/export-buttons";
import { LoadingProgress } from "@/components/ui/loading-progress";
import { useCreepingProgress } from "@/lib/use-creeping-progress";

interface SummaryPanelProps {
  file: File;
}

type Phase = "idle" | "extracting" | "summarizing" | "success" | "error";
type CopyStatus = "idle" | "copied";

const LENGTH_OPTIONS: { value: SummaryLength; label: string }[] = [
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
];

export function SummaryPanel({ file }: SummaryPanelProps) {
  const [length, setLength] = useState<SummaryLength>("medium");
  const [phase, setPhase] = useState<Phase>("idle");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const copyTimerRef = useRef<number | null>(null);

  // Extracted document text is kept out of the UI entirely — it only feeds
  // the summarizer and the Q&A feature. Held in state so it can be rendered
  // into the Q&A section without touching refs during render.
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [sourceWordCount, setSourceWordCount] = useState<number | null>(null);

  const extractionProgress = useCreepingProgress(phase === "extracting");
  const summaryProgress = useCreepingProgress(phase === "summarizing");

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const extractDocument = async (): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/extract", {
      method: "POST",
      body: formData,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.success) {
      throw new Error(
        payload?.error?.message ??
          "Something went wrong while extracting text. Please try again."
      );
    }

    const result = payload.data as {
      text: string;
      wordCount?: number;
    };

    setExtractedText(result.text);
    setSourceWordCount(
      typeof result.wordCount === "number" ? result.wordCount : null
    );

    return result.text;
  };

  const requestSummary = async (
    text: string,
    requestedLength: SummaryLength
  ): Promise<Summary> => {
    const response = await fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, length: requestedLength }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.success) {
      throw new Error(
        payload?.error?.message ??
          "Something went wrong while generating the summary. Please try again."
      );
    }

    return payload.data as Summary;
  };

  const runPipeline = async (requestedLength: SummaryLength) => {
    const needsExtraction = extractedText === null;

    setPhase(needsExtraction ? "extracting" : "summarizing");
    setErrorMessage(null);
    setShareUrl(null);
    setSummary(null);

    try {
      let text = extractedText;

      if (!text) {
        text = await extractDocument();
      }

      setPhase("summarizing");
      const generated = await requestSummary(text, requestedLength);

      saveHistoryEntry(
        createHistoryEntryFromSummary({
          summary: generated,
          length: requestedLength,
          fileName: file.name,
          sourceWordCount,
        })
      );

      setSummary(generated);
      setPhase("success");
    } catch (err) {
      // If extraction itself failed the cached text is still null, so the
      // next attempt re-runs extraction; a summarizer failure keeps it and
      // the retry goes straight to summary generation.
      setErrorMessage(
        err instanceof Error && err.message
          ? err.message
          : "Something went wrong. Check your connection and try again."
      );
      setPhase("error");
    }
  };

  const handleLengthChange = (newLength: SummaryLength) => {
    setLength(newLength);
    // If a summary already exists, regenerate immediately at the new length
    // so the length control feels live rather than requiring a second click.
    if (phase === "success" || phase === "error") {
      runPipeline(newLength);
    }
  };

    const handleCopySummary = async () => {
    if (!summary) return;

    const sections = [
      summary.title,
      `Document Type: ${summary.documentType}`,
      "",
      "Summary",
      summary.summary,
    ];

    if (summary.keyPoints.length > 0) {
      sections.push("", "Key Points", ...summary.keyPoints.map((item) => `• ${item}`));
    }

    if (summary.mainIdeas.length > 0) {
      sections.push("", "Main Ideas", ...summary.mainIdeas.map((item) => `• ${item}`));
    }

    if (summary.actionItems.length > 0) {
      sections.push("", "Action Items", ...summary.actionItems.map((item) => `• ${item}`));
    }

    if (summary.entities.length > 0) {
      sections.push("", "Mentioned", summary.entities.join(", "));
    }

    const copied = await copyTextToClipboard(sections.join("\n"));

    if (!copied) return;

    setCopyStatus("copied");

    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }

    copyTimerRef.current = window.setTimeout(() => {
      setCopyStatus("idle");
      copyTimerRef.current = null;
    }, 2000);
  };

  const handleGenerateLink = () => {
    if (!summary) return;
    // window is only touched inside this handler so SSR stays safe.
    setShareUrl(buildShareLink(summary, window.location.origin));
    setCopyStatus("idle");
  };

  const handleCopy = async () => {
    if (!shareUrl) return;

    const copied = await copyTextToClipboard(shareUrl);
    if (!copied) return;

    setCopyStatus("copied");
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => {
      setCopyStatus("idle");
      copyTimerRef.current = null;
    }, 2000);
  };

  const exportMeta = {
    fileName: file.name,
    length,
  };

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-zinc-700 ring-1 ring-zinc-200">
            <Sparkles aria-hidden="true" className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-900">Summary</p>
            <p className="text-xs text-zinc-500">
              Generate a smart summary of your document.
            </p>
          </div>
        </div>

        <div
          role="group"
          aria-label="Summary length"
          className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5"
        >
          {LENGTH_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleLengthChange(option.value)}
              disabled={
                phase === "extracting" || phase === "summarizing"
              }
              aria-pressed={length === option.value}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                length === option.value
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        {(phase === "idle" || phase === "error") && (
          <div className="space-y-3">
            {phase === "error" && errorMessage && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3"
              >
                <AlertCircle
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
                />
                <p className="text-sm text-red-700">{errorMessage}</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => runPipeline(length)}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
            >
              {phase === "error" ? "Try again" : "Generate summary"}
            </button>
          </div>
        )}

        {phase === "extracting" && (
          <LoadingProgress
            label={`Extracting text from ${file.name}…`}
            progress={extractionProgress}
          />
        )}

        {phase === "summarizing" && (
          <LoadingProgress
            label={`Generating ${length} summary…`}
            progress={summaryProgress}
          />
        )}

        {phase === "success" && summary && (
          <SummaryView
            summary={summary}
            headerAction={
  <>
    <ExportButtons summary={summary} meta={exportMeta} />
    <button
      type="button"
      onClick={handleCopySummary}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2",
        copyStatus === "copied"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
      )}
    >
      {copyStatus === "copied" ? (
        <>
          <Check aria-hidden="true" className="h-3.5 w-3.5" />
          Copied!
        </>
      ) : (
        <>
          <Copy aria-hidden="true" className="h-3.5 w-3.5" />
          Copy
        </>
      )}
    </button>

    <button
      type="button"
      onClick={handleGenerateLink}
      aria-expanded={shareUrl !== null}
      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
    >
      Share
    </button>

    <button
      type="button"
      onClick={() => runPipeline(length)}
      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
    >
      Regenerate
    </button>
  </>
}
          >
            {shareUrl && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    onFocus={(event) => event.target.select()}
                    aria-label="Shareable summary link"
                    className="min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2",
                      copyStatus === "copied"
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "bg-zinc-900 text-white hover:bg-zinc-800"
                    )}
                  >
                    {copyStatus === "copied" ? (
                      <>
                        <Check aria-hidden="true" className="h-3.5 w-3.5" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                        Copy link
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShareUrl(null)}
                    aria-label="Hide share link"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-zinc-500">
                  <Link2
                    aria-hidden="true"
                    className="mt-0.5 h-3 w-3 shrink-0"
                  />
                  Anyone with this link can view this summary — only the
                  summary is shared, never your document.
                </p>
              </div>
            )}
          </SummaryView>
        )}

        {phase === "success" && extractedText && (
          <DocumentQa text={extractedText} />
        )}
      </div>
    </div>
  );
}
