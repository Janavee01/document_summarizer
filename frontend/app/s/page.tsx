"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  FileText,
  Loader2,
  Sparkles,
} from "lucide-react";
import { parseShareLink } from "@/lib/share";
import type { Summary } from "@/types/summary";
import { SummaryView } from "@/components/summary/summary-view";

// The summary payload lives in the URL fragment, which only exists in the
// browser. `null` means "not yet hydrated" (rendered as loading); an empty
// string means there is no payload at all.
function subscribeToHashChange(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function getHash(): string {
  return window.location.hash;
}

function getServerHash(): null {
  return null;
}

export default function SharedSummaryPage() {
  const hash = useSyncExternalStore(
    subscribeToHashChange,
    getHash,
    getServerHash
  );

  const summary = useMemo<Summary | null>(
    () => (hash === null ? null : parseShareLink(hash)),
    [hash]
  );

  return (
    <main className="flex min-h-screen items-start justify-center px-4 py-10 sm:py-16">
      <section className="card-index w-full max-w-2xl p-6 sm:p-8">
        <div className="mb-7 text-center">
          <span className="stamp mx-auto text-teal">
            <Sparkles aria-hidden="true" className="h-3 w-3" />
            Shared
          </span>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink">
            Shared summary
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink-soft">
            A document summary generated with Document Intelligence.
          </p>
        </div>

        {hash === null && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-center gap-2 rounded-lg border border-line bg-paper px-4 py-3 text-sm text-ink-soft"
          >
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-teal" />
            Opening shared summary…
          </div>
        )}

        {hash !== null && !summary && (
          <div className="space-y-4">
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3"
            >
              <AlertCircle
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-danger"
              />
              <p className="text-sm text-danger">
                This shared summary link is invalid or incomplete. Ask the
                sender to share it again.
              </p>
            </div>
            <Link
              href="/"
              className="flex items-center justify-center gap-2 rounded-lg bg-teal px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
            >
              <FileText aria-hidden="true" className="h-4 w-4" />
              Summarize your own document
            </Link>
          </div>
        )}

        {summary && (
          <>
            <SummaryView summary={summary} />
            <hr className="my-6 border-line" />
            <Link
              href="/"
              className="flex items-center justify-center gap-2 rounded-lg border border-line bg-paper-raised px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-teal/40 hover:text-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Summarize your own document
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
