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
import { buildShareLink } from "@/lib/share";
import { copyTextToClipboard } from "@/lib/clipboard";
import type { Summary, SummaryLength } from "@/types/summary";
import {
  createHistoryEntryFromSummary,
  saveHistoryEntry,
} from "@/lib/history";
import { buildClipboardText } from "@/lib/summary-export";
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

    const copied = await copyTextToClipboard(buildClipboardText(summary));

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
    <div className="mt-6 overflow-hidden rounded-xl border border-line bg-paper-raised">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-soft text-teal">
            <Sparkles aria-hidden="true" className="h-4 w-4" />
          </div>
          <div>
            <p className="font-display text-sm font-semibold text-ink">
              Summary
            </p>
            <p className="text-xs text-ink-faint">
              A smart summary of your document.
            </p>
          </div>
        </div>

        <div
          role="group"
          aria-label="Summary length"
          className="inline-flex rounded-lg border border-line bg-paper p-0.5"
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
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal disabled:cursor-not-allowed disabled:opacity-50",
                length === option.value
                  ? "bg-teal text-white"
                  : "text-ink-soft hover:bg-teal-soft hover:text-teal"
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
                className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3"
              >
                <AlertCircle
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-danger"
                />
                <p className="text-sm text-danger">{errorMessage}</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => runPipeline(length)}
              className="w-full rounded-lg bg-teal px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
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
        "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2",
        copyStatus === "copied"
          ? "border-teal/30 bg-teal-soft text-teal"
          : "border-line bg-paper-raised text-ink-soft hover:border-teal/40 hover:text-teal"
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
      className="rounded-lg border border-line bg-paper-raised px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-teal/40 hover:text-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
    >
      Share
    </button>

    <button
      type="button"
      onClick={() => runPipeline(length)}
      className="rounded-lg border border-line bg-paper-raised px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-teal/40 hover:text-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
    >
      Regenerate
    </button>
  </>
}
          >
            {shareUrl && (
              <div className="rounded-lg border border-teal/25 bg-teal-soft/60 p-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    onFocus={(event) => event.target.select()}
                    aria-label="Shareable summary link"
                    className="min-w-0 flex-1 rounded-md border border-line bg-paper-raised px-2.5 py-1.5 font-mono text-xs text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2",
                      copyStatus === "copied"
                        ? "bg-teal text-white"
                        : "bg-teal text-white hover:bg-teal/90"
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
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-paper-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-ink-soft">
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
