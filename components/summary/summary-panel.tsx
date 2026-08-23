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
import { SummaryView } from "@/components/summary/summary-view";
import { DocumentQa } from "@/components/summary/document-qa";
import { LoadingProgress } from "@/components/ui/loading-progress";
import { useCreepingProgress } from "@/lib/use-creeping-progress";

interface SummaryPanelProps {
  text: string;
}

type SummaryStatus = "idle" | "loading" | "success" | "error";
type CopyStatus = "idle" | "copied";

const LENGTH_OPTIONS: { value: SummaryLength; label: string }[] = [
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
];

export function SummaryPanel({ text }: SummaryPanelProps) {
  const [length, setLength] = useState<SummaryLength>("medium");
  const [status, setStatus] = useState<SummaryStatus>("idle");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const copyTimerRef = useRef<number | null>(null);
  const summaryProgress = useCreepingProgress(status === "loading");

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const generateSummary = async (requestedLength: SummaryLength) => {
    if (status === "loading") return;

    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, length: requestedLength }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        setShareUrl(null);
        setStatus("error");
        setErrorMessage(
          payload?.error?.message ??
            "Something went wrong while generating the summary. Please try again."
        );
        return;
      }

      setSummary(payload.data as Summary);
      setShareUrl(null);
      setStatus("success");
    } catch {
      setShareUrl(null);
      setStatus("error");
      setErrorMessage(
        "Something went wrong while generating the summary. Check your connection and try again."
      );
    }
  };

  const handleLengthChange = (newLength: SummaryLength) => {
    setLength(newLength);
    // If a summary already exists, regenerate immediately at the new length
    // so the length control feels live rather than requiring a second click.
    if (status === "success" || status === "error") {
      generateSummary(newLength);
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
              Generate a smart summary of the extracted text.
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
              aria-pressed={length === option.value}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
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
        {status === "idle" && (
          <button
            type="button"
            onClick={() => generateSummary(length)}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
          >
            Generate summary
          </button>
        )}

        {status === "loading" && (
  <LoadingProgress
    label={`Generating ${length} summary…`}
    progress={summaryProgress}
  />
)}

        {status === "error" && errorMessage && (
          <div className="space-y-3">
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
            <button
              type="button"
              onClick={() => generateSummary(length)}
              className="w-full rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
            >
              Try again
            </button>
          </div>
        )}

        {status === "success" && summary && (
          <SummaryView
            summary={summary}
            headerAction={
  <>
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
      onClick={() => generateSummary(length)}
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

        {status === "success" && <DocumentQa text={text} />}
      </div>
    </div>
  );
}
