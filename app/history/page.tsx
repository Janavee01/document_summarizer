"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Eye,
  EyeOff,
  FileText,
  History,
  Inbox,
  Sparkles,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  deleteHistoryEntry,
  loadHistory,
  type HistoryEntry,
} from "@/lib/history";
import { formatExportDate } from "@/lib/summary-export";
import { SummaryView } from "@/components/summary/summary-view";
import { ExportButtons } from "@/components/summary/export-buttons";

const LENGTH_LABELS: Record<HistoryEntry["length"], string> = {
  short: "Short",
  medium: "Medium",
  long: "Long",
};

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null
  );

  useEffect(() => {
    // Deferred so we don't call setState synchronously inside the effect
    // (cascading-render rule); localStorage only exists in the browser.
    const timer = window.setTimeout(() => setEntries(loadHistory()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const stats = useMemo(() => {
    if (!entries) return null;

    const uniqueFiles = new Set(
      entries.map((entry) => entry.fileName ?? entry.id)
    );
    const latest = entries[0]?.createdAt;

    return {
      total: entries.length,
      documents: uniqueFiles.size,
      lastActivity: latest ? formatExportDate(latest) : "—",
    };
  }, [entries]);

  const handleToggleExpand = (id: string) => {
    setExpandedId((current) => (current === id ? null : id));
    setConfirmingDeleteId(null);
  };

  const handleDelete = (id: string) => {
    if (confirmingDeleteId !== id) {
      setConfirmingDeleteId(id);
      return;
    }

    setConfirmingDeleteId(null);
    if (expandedId === id) {
      setExpandedId(null);
    }
    setEntries(deleteHistoryEntry(id));
  };

  return (
    <main className="flex min-h-screen items-start justify-center bg-zinc-50 px-4 py-10 font-sans text-zinc-950">
      <section className="w-full max-w-3xl">
        <div className="mb-7 text-center">
          <p className="mb-2 flex items-center justify-center gap-1.5 text-sm font-medium text-zinc-500">
            <History aria-hidden="true" className="h-4 w-4" />
            Dashboard
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Summary history
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Every summary you generate is saved here on this device.
          </p>
          <Link
            href="/"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
          >
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
            New summary
          </Link>
        </div>

        {stats && (
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Summaries" value={String(stats.total)} />
            <StatCard label="Documents" value={String(stats.documents)} />
            <StatCard
              label="Last activity"
              value={stats.lastActivity}
              icon={<CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />}
              isText
            />
          </div>
        )}

        {entries === null && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-8 text-sm text-zinc-600 shadow-sm"
          >
            Loading your summaries…
          </div>
        )}

        {entries !== null && entries.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-50 text-zinc-500 ring-1 ring-zinc-200">
              <Inbox aria-hidden="true" className="h-6 w-6" />
            </div>
            <p className="mt-4 text-sm font-medium text-zinc-900">
              No summaries yet
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Upload a document to generate your first summary.
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
            >
              <FileText aria-hidden="true" className="h-4 w-4" />
              Summarize a document
            </Link>
          </div>
        )}

        {entries !== null && entries.length > 0 && (
          <ul className="space-y-3">
            {entries.map((entry) => {
              const isExpanded = expandedId === entry.id;
              const isConfirmingDelete = confirmingDeleteId === entry.id;
              const snippet =
                entry.summary.summary.length > 180
                  ? `${entry.summary.summary.slice(0, 180).trimEnd()}…`
                  : entry.summary.summary;

              return (
                <li
                  key={entry.id}
                  className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
                >
                  <div className="px-4 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => handleToggleExpand(entry.id)}
                          aria-expanded={isExpanded}
                          className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 rounded-md"
                        >
                          <p className="truncate text-sm font-semibold text-zinc-900">
                            {entry.summary.title}
                          </p>
                        </button>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600">
                            {entry.summary.documentType}
                          </span>
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600">
                            {LENGTH_LABELS[entry.length]}
                          </span>
                          <span>{formatExportDate(entry.createdAt)}</span>
                          {entry.fileName && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="max-w-[14rem] truncate">
                                {entry.fileName}
                              </span>
                            </>
                          )}
                          {entry.sourceWordCount !== null && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>
                                {entry.sourceWordCount.toLocaleString()} words
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 sm:shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleExpand(entry.id)}
                          aria-expanded={isExpanded}
                          aria-label={
                            isExpanded
                              ? "Collapse summary"
                              : "View full summary"
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
                        >
                          {isExpanded ? (
                            <EyeOff aria-hidden="true" className="h-4 w-4" />
                          ) : (
                            <Eye aria-hidden="true" className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(entry.id)}
                          aria-label={
                            isConfirmingDelete
                              ? "Confirm delete summary"
                              : "Delete summary"
                          }
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2",
                            isConfirmingDelete
                              ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                              : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-red-600"
                          )}
                        >
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                          {isConfirmingDelete ? "Sure?" : null}
                        </button>
                      </div>
                    </div>

                    {!isExpanded && (
                      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-zinc-600">
                        {snippet}
                      </p>
                    )}

                    {isExpanded && (
                      <div className="mt-4 space-y-4 border-t border-zinc-100 pt-4">
                        <SummaryView
                          summary={entry.summary}
                          headerAction={
                            <ExportButtons
                              summary={entry.summary}
                              meta={{
                                fileName: entry.fileName,
                                generatedAt: entry.createdAt,
                                length: entry.length,
                              }}
                            />
                          }
                        />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
  isText = false,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  isText?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <p className="flex items-center gap-1 text-xs font-medium text-zinc-500">
        {icon}
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-semibold text-zinc-900",
          isText ? "text-sm leading-6" : "text-xl"
        )}
      >
        {value}
      </p>
    </div>
  );
}
