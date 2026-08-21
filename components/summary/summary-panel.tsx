"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  ListChecks,
  Loader2,
  Sparkles,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Summary, SummaryLength } from "@/types/summary";

interface SummaryPanelProps {
  text: string;
}

type SummaryStatus = "idle" | "loading" | "success" | "error";

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
        setStatus("error");
        setErrorMessage(
          payload?.error?.message ??
            "Something went wrong while generating the summary. Please try again."
        );
        return;
      }

      setSummary(payload.data as Summary);
      setStatus("success");
    } catch {
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
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600"
          >
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            Generating {length} summary…
          </div>
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
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-zinc-900">
                  {summary.title}
                </p>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                  <Tag aria-hidden="true" className="h-3 w-3" />
                  {summary.documentType}
                </span>
              </div>
              <button
                type="button"
                onClick={() => generateSummary(length)}
                className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
              >
                Regenerate
              </button>
            </div>

            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
              {summary.summary}
            </p>

            {summary.keyPoints.length > 0 && (
              <SummarySection
                icon={<CheckCircle2 aria-hidden="true" className="h-4 w-4" />}
                title="Key points"
                items={summary.keyPoints}
              />
            )}

            {summary.mainIdeas.length > 0 && (
              <SummarySection
                icon={<Lightbulb aria-hidden="true" className="h-4 w-4" />}
                title="Main ideas"
                items={summary.mainIdeas}
              />
            )}

            {summary.actionItems.length > 0 && (
              <SummarySection
                icon={<ListChecks aria-hidden="true" className="h-4 w-4" />}
                title="Action items"
                items={summary.actionItems}
              />
            )}

            {summary.entities.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                  <Tag aria-hidden="true" className="h-3.5 w-3.5" />
                  Mentioned
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {summary.entities.map((entity) => (
                    <span
                      key={entity}
                      className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-700"
                    >
                      {entity}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SummarySection({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
        {icon}
        {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2 text-sm leading-relaxed text-zinc-800"
          >
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
